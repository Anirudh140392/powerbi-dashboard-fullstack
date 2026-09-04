/**
 * One-shot backfill: ask Gemini to assign a specific master_category to every
 * Prestige SKU that currently has master_category NULL. The mapping table is
 * the same SPECIFIC_TAXONOMY used by sync_mysql_master.cjs, so categories
 * flow back into the rest of the app on the next master sync.
 *
 * Cost guard: hard caps at MAX_ROWS (default 5000) and slows down via
 * RATE_DELAY_MS between calls. Each row is ~150 tokens out + ~80 tokens in
 * → ~$0.0002 per row on gemini-2.5-flash-lite. 5000 rows ≈ $1.
 *
 * Usage:
 *   COMPANY_ID=… node scripts/backfill_master_category_with_gemini.cjs
 *   COMPANY_ID=… MAX_ROWS=200 node scripts/backfill_master_category_with_gemini.cjs   # dry-runnish
 */
require('dotenv').config();
const { Pool } = require('pg');

const COMPANY_ID = process.env.COMPANY_ID;
const MAX_ROWS = parseInt(process.env.MAX_ROWS || '5000', 10);
const RATE_DELAY_MS = parseInt(process.env.RATE_DELAY_MS || '350', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_BACKFILL_MODEL || 'gemini-2.5-flash-lite';

if (!COMPANY_ID) { console.error('Missing COMPANY_ID'); process.exit(1); }
if (!GEMINI_API_KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

const TAXONOMY = [
    'Pressure Cooker','Kadai','Fry Pan','Tawa','Dosa Tawa',
    'Other Cookware','Cookware','Cookware Set','Gas Stove',
    'Mixer Grinder','Kettle','Rice Cooker','Toaster & OTG','Air Fryer',
    'Wet Grinder','Induction Cooktop','Sandwich Maker','Grill & Sandwich Maker',
    'Hand Blender','Glasstops and Hobs','Food Processor','Juicer','Iron',
    'Waffle Maker','Air Oven','Combo','Bottle',
];

const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function classifyOne(productName, brand) {
    const prompt = `You assign a single category from a fixed list to a kitchen-appliance product.
Categories (pick exactly one): ${TAXONOMY.join(', ')}

Rules:
- Product name like "X Kadai with Induction Base" -> "Kadai" (NOT Induction Cooktop)
- "Induction Cooktop" only when the product IS an induction cooktop appliance.
- "Cookware Set" when the listing is a set/combo (3 Pc, 5 Pc, etc.).
- "Other Cookware" for cookware that doesn't fit Kadai/Tawa/Fry Pan.
- If genuinely unknown, return null.

Product brand: ${brand || 'unknown'}
Product name: ${productName}

Return ONLY JSON: {"category": "<one of the list, or null>"}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0 },
        }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status} ${await res.text().catch(() => '')}`);
    const j = await res.json();
    const raw = j.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch { return null; }
    const cat = parsed.category;
    if (typeof cat !== 'string') return null;
    return TAXONOMY.includes(cat) ? cat : null;
}

async function main() {
    console.log(`Backfilling master_category for company ${COMPANY_ID} (max ${MAX_ROWS} rows)`);

    const { rows } = await pool.query(`
        SELECT id, product_external_id AS web_pid, product_name, brand_name
          FROM masters.products
         WHERE company_id = $1
           AND is_competitor = false
           AND (master_category IS NULL OR master_category = '')
           AND product_name IS NOT NULL
         ORDER BY id
         LIMIT $2
    `, [COMPANY_ID, MAX_ROWS]);

    console.log(`${rows.length} SKUs to classify.`);
    let ok = 0, skipped = 0, errored = 0;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
            const cat = await classifyOne(r.product_name, r.brand_name);
            if (cat) {
                await pool.query(
                    `UPDATE masters.products
                        SET master_category = $1
                      WHERE id = $2 AND (master_category IS NULL OR master_category = '')`,
                    [cat, r.id]
                );
                ok++;
                if (i % 25 === 0) {
                    console.log(`[${i + 1}/${rows.length}] "${(r.product_name || '').slice(0, 60)}" -> ${cat}  (ok=${ok} skipped=${skipped} err=${errored})`);
                }
            } else {
                skipped++;
            }
        } catch (e) {
            errored++;
            if (errored < 5) console.warn(`[${r.web_pid}] ${e.message}`);
        }
        // Rate limit so we don't trip Gemini's free-tier RPM cap.
        if (RATE_DELAY_MS > 0) await new Promise(r => setTimeout(r, RATE_DELAY_MS));
    }
    console.log(`Done. classified=${ok} skipped=${skipped} errored=${errored}`);

    // Cascade: anywhere the resolveCategory mapping would now produce a new
    // value, push category to match master_category for the rows we just touched.
    await pool.query(`
        UPDATE masters.products mp
           SET category = mp.master_category
         WHERE company_id = $1
           AND mp.master_category = ANY($2::text[])
           AND mp.category IS DISTINCT FROM mp.master_category
    `, [COMPANY_ID, TAXONOMY]);

    await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
