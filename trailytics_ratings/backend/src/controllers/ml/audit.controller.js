import pool from '../../config/db.js';
import spawnJobModule from '../../automation/spawnJob.cjs';
const { spawnJob, KNOWN_JOBS } = spawnJobModule;

export const inspectProduct = async (req, res) => {
    try {
        const { id, product_name, brand_name, description, asin, sku } = req.body;
        if (!id || !product_name) {
            return res.status(400).json({ error: 'id and product_name required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });

        // Fetch authorized categories from ML dictionary to prevent AI hallucination
        const { rows } = await pool.query(`SELECT dict_value FROM ratings.ml_dictionary WHERE dict_type = 'category' AND company_id = $1`, [req.companyId]);
        const validCategories = rows.map(r => r.dict_value).join('", "');

        const promptText = `
        Analyze the following product exactly:
        Brand: "${brand_name || ''}"
        Product Name: "${product_name}"
        ${asin ? `ASIN/FSIN: "${asin}"\n` : ''}${sku ? `SKU: "${sku}"\n` : ''}${description ? `Description/Specs: "${description}"\n` : ''}
        
        Extract information formatted exclusively as JSON with the following keys:
        - "category" (STRICTLY ONE OF: ["${validCategories}"]. Do not invent new categories. Find the best fit.)
        - "material" (e.g. "Glass", "Stainless Steel", "Cast Iron", "Hard Anodised". If none found, return null.)
        - "wattage" (e.g. "500W", "750W", "1200W". If none found, return null.)
        - "capacity" (e.g. "1.5 Litre", "3L", "26cm". If none found, return null.)
        - "color" (e.g. "Black", "Silver", "Red". If none found, return null.)
        - "warranty" (e.g. "1 Year", "5 Years". If none found, return null.)
        
        If missing from the provided text, use your internal knowledge of the exact ASIN/SKU or Brand Name to deduce accurate specs.
        Rules: Output ONLY valid JSON, absolutely no markdown wrapping, no \`\`\`.
        `;

        const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + apiKey, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { temperature: 0.1 }
            })
        });

        if (!aiRes.ok) throw new Error("Google AI Error: " + aiRes.statusText);
        const aiJson = await aiRes.json();
        const rawResponse = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
        // Clean markdown if accidentally returned
        const cleanResponse = rawResponse.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const extracted = JSON.parse(cleanResponse);

        res.json({
            success: true,
            persisted: false,
            ai_extraction: extracted,
            message: 'Preview generated. Production master data was not changed because no audited master QC store is configured.'
        });
    } catch (err) {
        console.error('AI Product Extraction error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/ratings/competitor-mentions — server-side scan results
// Replaces the in-browser competitor scanner in src/utils/competitorDetection.ts
// (which only saw the currently-rendered review page so the UI used to read 0
// mentions on most filters). Returned shape mirrors aggregateMentionsByBrand
// for drop-in compatibility with VerbatimMentionsCard.
// ============================================================================

export const getPendingAudit = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                m.*,
                r.rating as original_rating
            FROM ratings.reviews_ml_audit m
            JOIN ratings.reviews r ON r.id = m.review_id
            WHERE m.company_id = $1 
              -- Only flag discrepancies in fields /approve actually merges (category,
              -- material, wattage, rating). Sentiment / issue fields are owned by the
              -- in-house classifier and are NOT written on approve, so flagging them
              -- produced no-op audits that re-appeared in the queue forever.
              AND (
                    COALESCE(m.ml_category, m.rules_category) IS DISTINCT FROM r.category
                 OR COALESCE(m.ml_material, m.rules_material) IS DISTINCT FROM r.material
                 OR COALESCE(m.ml_wattage, m.rules_wattage) IS DISTINCT FROM r.wattage
                 OR m.ml_inferred_rating IS DISTINCT FROM r.ml_inferred_rating
              )
            ORDER BY m.audit_date DESC
            LIMIT 100
        `, [req.companyId]);
        res.json({ audits: rows });
    } catch (err) {
        console.error('ml-audit pending error:', err);
        res.status(500).json({ error: err.message });
    }
};

// 2. Approve ML recommendations and merge into Master

export const approveAudit = async (req, res) => {
    try {
        const { audit_ids } = req.body;
        if (!Array.isArray(audit_ids) || audit_ids.length === 0) {
            return res.status(400).json({ error: 'Provide an array of audit_ids' });
        }

        // Single bulk UPDATE-FROM replacing the previous N+1 (one SELECT + one UPDATE per audit).
        // ml_* fields are preferred over rules_* fields (matches the prior JS `||` coalescing,
        // including treating empty strings as null via NULLIF). Source columns are stamped
        // 'ml_approved' on any field where the audit actually contributed a non-null value.
        const result = await pool.query(`
            UPDATE ratings.reviews r
            SET
                category              = COALESCE(NULLIF(a.ml_category,''),    NULLIF(a.rules_category,''),  r.category),
                category_source       = CASE WHEN COALESCE(NULLIF(a.ml_category,''), NULLIF(a.rules_category,'')) IS NOT NULL
                                             THEN 'ml_approved' ELSE r.category_source END,
                material              = COALESCE(NULLIF(a.ml_material,''),    NULLIF(a.rules_material,''),  r.material),
                wattage               = COALESCE(NULLIF(a.ml_wattage,''),     NULLIF(a.rules_wattage,''),   r.wattage),
                -- sentiment / sentiment_category / sentiment_subcategory are now owned by the
                -- in-house SetFit classifier + gold-star sentiment (loaded directly into reviews).
                -- Approving the legacy DeBERTa audit must NOT overwrite them, or it reverts the
                -- new classifications. Approval still curates category / material / wattage / rating.
                ml_inferred_rating    = COALESCE(CASE WHEN a.ml_inferred_rating BETWEEN 1 AND 5
                                                      THEN a.ml_inferred_rating END,                       r.ml_inferred_rating),
                updated_at            = NOW()
            FROM ratings.reviews_ml_audit a
            WHERE a.id = ANY($1::uuid[])
              AND a.company_id = $2
              AND r.id = a.review_id
        `, [audit_ids, req.companyId]);

        // Capture the human-approved labels into ratings.ml_training_set so we
        // can fine-tune the rating + category models on Prestige-specific data
        // once we cross ~3K rows. Best-effort: ignore failures here so a
        // training-set write error never blocks an approval.
        try {
            await pool.query(`
                INSERT INTO ratings.ml_training_set (
                    company_id, review_id, product_name, review_text, user_rating,
                    approved_rating, approved_sentiment, approved_category,
                    approved_subcategory, approved_material, approved_wattage,
                    source_audit_id, ml_confidence, ml_reasoning
                )
                SELECT
                    a.company_id, a.review_id, a.product_name, a.review_text,
                    a.original_user_rating,
                    CASE WHEN a.ml_inferred_rating BETWEEN 1 AND 5
                         THEN a.ml_inferred_rating ELSE NULL END,
                    a.ml_sentiment,
                    COALESCE(NULLIF(a.ml_category,''), NULLIF(a.rules_category,'')),
                    COALESCE(NULLIF(a.ml_issue_subcategory,''), NULLIF(a.ml_issue,'')),
                    NULLIF(a.ml_material,''),
                    NULLIF(a.ml_wattage,''),
                    a.id, a.ml_confidence_score, a.ml_reasoning
                  FROM ratings.reviews_ml_audit a
                 WHERE a.id = ANY($1::uuid[])
                   AND a.company_id = $2
                   -- Don't double-insert if the same audit was approved before
                   AND NOT EXISTS (
                       SELECT 1 FROM ratings.ml_training_set t
                        WHERE t.source_audit_id = a.id
                   )
            `, [audit_ids, req.companyId]);
        } catch (e) {
            console.warn('[ml-audit/approve] training-set capture failed (non-fatal):', e.message);
        }

        res.json({ success: true, message: `Approved ${result.rowCount} ML records.`, count: result.rowCount });
    } catch (err) {
        console.error('ml-audit approve error:', err);
        res.status(500).json({ error: err.message });
    }
};

// 3. Reject ML recommendations

export const rejectAudit = async (req, res) => {
    try {
        const { audit_ids } = req.body;
        if (!Array.isArray(audit_ids) || audit_ids.length === 0) {
            return res.status(400).json({ error: 'Provide an array of audit_ids' });
        }

        const placeholders = audit_ids.map((_, i) => `$${i + 2}`).join(',');
        await pool.query(`DELETE FROM ratings.reviews_ml_audit WHERE company_id = $1 AND id IN (${placeholders})`, [req.companyId, ...audit_ids]);
        
        res.json({ success: true, message: `Rejected ${audit_ids.length} ML records.` });
    } catch (err) {
        console.error('ml-audit reject error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ML job spawn + ml_jobs_log bookkeeping lives in a shared module so the
// Temporal worker activity (runMlJob) reuses the exact same implementation.


export const bulkTriggerAudit = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Array of ids required' });
        }
        
        // 1. Fetch source rows
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        const { rows } = await pool.query(
            `SELECT id, product_name, review_text, rating, sentiment, specific_issue, category, material, wattage 
             FROM ratings.reviews 
             WHERE company_id = $1 AND id IN (${placeholders})`,
            [req.companyId, ...ids]
        );

        if (rows.length === 0) {
            return res.json({ success: true, message: 'No rows found.' });
        }

        // 2. Prepare API Call to Gemini
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing.' });
        }

        console.log(`[ML Bulk] Sending ${rows.length} rows to Gemini...`);
        const payloadData = rows.map(r => ({
            id: r.id, 
            product: r.product_name, 
            text: r.review_text, 
            rating: r.rating 
        }));

        // 1.5 Fetch Stakeholder Subcategories to enforce strict mapping
        const { rows: ruleRows } = await pool.query(
            `SELECT sentiment_subcategory FROM ratings.stakeholder_mappings WHERE company_id = $1`,
            [req.companyId]
        );
        const subcategoriesList = ruleRows.map(r => r.sentiment_subcategory).join("', '");
        const subcategoriesGuidance = ruleRows.length > 0 
            ? `If an issue is present, MUST STRICTLY be one of the following exact strings: ['${subcategoriesList}']. If no issue, return empty string.` 
            : `If a problem is discussed. Else empty string.`;

        const prompt = `
        You are a Data Quality Auditor for an E-Commerce Analytics platform.
        You are given a JSON array of product reviews.
        For each review, analyze it and return a strict JSON array of objects.
        Required JSON Object keys for each array item:
        - id: Exact string id provided
        - category: The assigned product category based on product name (e.g. 'Mixer Grinder', 'Cookware Set', 'Gas Stove', 'Kettle'). MUST NOT BE EMPTY.
        - material: If Cookware, extract exact material ('Aluminium', 'Stainless Steel', 'Hard Anodised', 'Cast Iron', 'Triply'). Else empty string.
        - wattage: If Electric Appliance, exact wattage ('500W', '750W', '1000W', '1200W'). Else empty string.
        - sentiment: Strictly 'Positive', 'Negative', or 'Neutral' based on review text. MUST NOT BE EMPTY. Format in Title Case.
        - specific_issue: ${subcategoriesGuidance}
        - confidence_score: 1 to 10 numerical quality score based on your classification confidence.
        - reasoning: Brief 1-sentence reasoning for the classification.
        
        Reviews to analyze:
        ${JSON.stringify(payloadData)}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
            })
        });

        const gRes = await response.json();
        const rawText = gRes.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!rawText) {
            throw new Error('Gemini API did not return readable text.');
        }

        const mlResults = JSON.parse(rawText);
        let inserted = 0;
        const { rows: existingAuditRows } = await pool.query(
            `SELECT review_id FROM ratings.reviews_ml_audit WHERE company_id = $1 AND review_id = ANY($2::uuid[])`,
            [req.companyId, rows.map(r => r.id)]
        );
        const existingAuditIds = new Set(existingAuditRows.map(r => String(r.review_id)));

        // 3. Insert into the safe QC Tracker table
        for (const mlResult of mlResults) {
            const originalRow = rows.find(r => r.id === mlResult.id);
            if (!originalRow || existingAuditIds.has(String(originalRow.id))) continue;

            await pool.query(`
                INSERT INTO ratings.reviews_ml_audit (
                    review_id, company_id, product_name, review_text,
                    original_category, ml_category,
                    original_material, ml_material,
                    original_wattage, ml_wattage,
                    original_user_rating, original_sentiment, ml_sentiment,
                    original_issue, ml_issue, ml_confidence_score, ml_reasoning
                ) VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17
                )
            `, [
                originalRow.id, req.companyId, originalRow.product_name, originalRow.review_text,
                originalRow.category, mlResult.category,
                originalRow.material, mlResult.material || null,
                originalRow.wattage, mlResult.wattage || null,
                originalRow.rating, originalRow.sentiment, mlResult.sentiment,
                originalRow.specific_issue, mlResult.specific_issue || null, mlResult.confidence_score, mlResult.reasoning
            ]);
            inserted++;
        }

        res.json({ success: true, message: `Audited ${inserted} rows successfully and pushed to QC Tracker.` });
    } catch (err) {
        console.error('Data Lake bulk trigger error:', err);
        res.status(500).json({ error: err.message });
    }
};
