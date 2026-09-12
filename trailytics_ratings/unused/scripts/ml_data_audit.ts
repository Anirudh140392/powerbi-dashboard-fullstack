import { GoogleGenAI, Type } from '@google/genai';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

const pool = new pg.Pool({
    host: requireEnv('DB_HOST'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(requireEnv('DB_PORT'), 10),
    ssl: { rejectUnauthorized: false }
});

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const WATTAGE_PATTERN = /\b(\d+(?:[.,]\d+)?\s*(?:W|Watts|kw|kilowatt))\b/i;

const MLAuditSchema = {
    type: Type.OBJECT,
    properties: {
        product_category: { type: Type.STRING },
        issue_category: { type: Type.STRING },
        issue_subcategory: { type: Type.STRING },
        material: { type: Type.STRING, nullable: true },
        wattage: { type: Type.STRING, nullable: true },
        sentiment: { type: Type.STRING },
        specific_issue: { type: Type.STRING, nullable: true },
        inferred_rating: { type: Type.INTEGER },
        rating_confidence_match: { type: Type.BOOLEAN },
        confidence_score: { type: Type.NUMBER },
        reasoning: { type: Type.STRING }
    },
    required: ["product_category", "issue_category", "issue_subcategory", "sentiment", "inferred_rating", "rating_confidence_match", "confidence_score", "reasoning"]
};

function normalizeText(value: string | null | undefined) {
    return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractRuleCategory(text: string, rules: Array<{ category: string; include_keywords: string[]; exclude_keywords: string[] }>, fallbackCategory: string | null) {
    const normalized = normalizeText(text);
    for (const rule of rules) {
        const includes = (rule.include_keywords || []).map(normalizeText).filter(Boolean);
        const excludes = (rule.exclude_keywords || []).map(normalizeText).filter(Boolean);
        if (includes.length > 0 && !includes.some(keyword => normalized.includes(keyword))) continue;
        if (excludes.length > 0 && excludes.some(keyword => normalized.includes(keyword))) continue;
        return rule.category;
    }
    return fallbackCategory;
}

function extractRuleMaterial(text: string, materials: string[]) {
    const normalized = normalizeText(text);
    return materials.find(material => normalized.includes(normalizeText(material))) || null;
}

function extractRuleWattage(text: string) {
    const match = text.match(WATTAGE_PATTERN);
    return match ? match[1].toUpperCase() : null;
}

async function auditReviews() {
    console.log("Starting Safe ML Data Audit (Validation Mode)");
    const companyId = requireEnv('COMPANY_ID');
    console.log(`[System] Company ID: ${companyId}`);

    if (!ai) {
        throw new Error("GEMINI_API_KEY is missing from environment.");
    }

    const client = await pool.connect();
    try {
        const [{ rows: categoryRuleRows }, { rows: materialRows }, { rows: stakeholderRows }] = await Promise.all([
            client.query(`
                SELECT category, include_keywords, exclude_keywords
                FROM ratings.category_rules
                WHERE company_id = $1
                ORDER BY priority ASC, id ASC
            `, [companyId]),
            client.query(`
                SELECT dict_value
                FROM ratings.ml_dictionary
                WHERE company_id = $1 AND dict_type = 'material'
                ORDER BY LENGTH(dict_value) DESC, dict_value
            `, [companyId]),
            client.query(`
                SELECT DISTINCT stakeholder, sentiment_subcategory
                FROM ratings.stakeholder_mappings
                WHERE company_id = $1
                  AND stakeholder IS NOT NULL
                  AND stakeholder <> ''
                  AND sentiment_subcategory IS NOT NULL
                  AND sentiment_subcategory <> ''
                ORDER BY stakeholder, sentiment_subcategory
            `, [companyId]),
        ]);

        if (categoryRuleRows.length === 0) throw new Error(`No category_rules found for company ${companyId}`);
        if (materialRows.length === 0) throw new Error(`No material dictionary rows found for company ${companyId}`);
        if (stakeholderRows.length === 0) throw new Error(`No stakeholder mappings found for company ${companyId}`);

        const allowedCategories = categoryRuleRows.map((row: { category: string }) => row.category);
        const allowedIssueCategories = Array.from(new Set(stakeholderRows.map((row: { stakeholder: string }) => row.stakeholder)));
        const allowedIssueSubcategories = Array.from(new Set(stakeholderRows.map((row: { sentiment_subcategory: string }) => row.sentiment_subcategory)));
        const materialDictionary = materialRows.map((row: { dict_value: string }) => row.dict_value);

        const result = await client.query(`
            SELECT id, company_id, product_name, review_text, rating, sentiment, specific_issue, category, material, wattage
            FROM ratings.reviews
            WHERE company_id = $1
              AND review_text IS NOT NULL
              AND LENGTH(review_text) > 10
              AND NOT EXISTS (
                    SELECT 1
                    FROM ratings.reviews_ml_audit a
                    WHERE a.company_id = ratings.reviews.company_id
                      AND a.review_id = ratings.reviews.id
              )
            LIMIT 500
        `, [companyId]);
        const reviews = result.rows;

        console.log(`Found ${reviews.length} reviews ready for ML auditing...`);
        if (reviews.length === 0) return;

        const existingAuditResult = await client.query(
            `SELECT review_id FROM ratings.reviews_ml_audit WHERE company_id = $1 AND review_id = ANY($2::uuid[])`,
            [companyId, reviews.map((review: { id: string }) => review.id)]
        );
        const existingAuditIds = new Set(existingAuditResult.rows.map((row: { review_id: string }) => String(row.review_id)));

        for (const review of reviews) {
            if (existingAuditIds.has(String(review.id))) continue;

            console.log(`\n---------------------------------`);
            console.log(`Auditing ID: ${review.id}`);
            console.log(`Product: ${review.product_name}`);
            console.log(`Text: "${review.review_text.substring(0, 50)}..." | User Rating: ${review.rating}★`);

            const searchText = `${review.product_name || ''} ${review.review_text || ''}`;
            const ruleCategory = extractRuleCategory(searchText, categoryRuleRows, review.category);
            const ruleMaterial = extractRuleMaterial(searchText, materialDictionary);
            const ruleWattage = extractRuleWattage(searchText);

            const prompt = `
            You are a Data Quality Auditor for an E-Commerce Analytics platform.
            Analyze this user review and product name to extract verified intelligence.

            Product Name: ${review.product_name}
            User Review Text: ${review.review_text}
            User Star Rating: ${review.rating} out of 5

            ALLOWED PRODUCT CATEGORIES: ${allowedCategories.join(', ')}
            ALLOWED ISSUE CATEGORIES: ${allowedIssueCategories.join(', ')}
            ALLOWED ISSUE SUBCATEGORIES: ${allowedIssueSubcategories.join(', ')}

            Return ONLY the strict JSON object matching the schema.
            Do not output categories or issue labels outside the allowed lists.
            Assess the review sentiment from text logic, regardless of the clicked star rating, to produce inferred_rating.
            `;

            let mlResult: any = null;
            try {
                const response = await ai.models.generateContent({
                    model: "gemini-flash-latest",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: MLAuditSchema,
                        temperature: 0.1,
                    }
                });
                mlResult = JSON.parse(response.text || "{}");
            } catch (error) {
                console.error(`ML generation failed for row ${review.id}:`, (error as Error).message);
                await new Promise(res => setTimeout(res, 2000));
                continue;
            }

            await client.query(`
                INSERT INTO ratings.reviews_ml_audit (
                    review_id, company_id, product_name, review_text,
                    original_category, rules_category, ml_category,
                    original_material, rules_material, ml_material,
                    original_wattage, rules_wattage, ml_wattage,
                    original_user_rating, original_sentiment, ml_sentiment,
                    original_issue, ml_issue, ml_confidence_score, ml_reasoning,
                    ml_inferred_rating, ml_issue_category, ml_issue_subcategory
                ) VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7,
                    $8, $9, $10,
                    $11, $12, $13,
                    $14, $15, $16,
                    $17, $18, $19, $20,
                    $21, $22, $23
                )
            `, [
                review.id, review.company_id, review.product_name, review.review_text,
                review.category, ruleCategory, mlResult.product_category,
                review.material, ruleMaterial, mlResult.material || null,
                review.wattage, ruleWattage, mlResult.wattage || null,
                review.rating, review.sentiment, mlResult.sentiment,
                review.specific_issue, mlResult.specific_issue || null, mlResult.confidence_score, mlResult.reasoning,
                mlResult.inferred_rating, mlResult.issue_category, mlResult.issue_subcategory
            ]);

            console.log(`Logged ML audit (Confidence: ${mlResult.confidence_score}%)`);
            await new Promise(res => setTimeout(res, 500));
        }

        console.log(`\nAudit completed. Inspect ratings.reviews_ml_audit for results.`);
    } finally {
        client.release();
        await pool.end();
    }
}

auditReviews().catch(error => {
    console.error("Fatal error running audit:", error);
    process.exit(1);
});
