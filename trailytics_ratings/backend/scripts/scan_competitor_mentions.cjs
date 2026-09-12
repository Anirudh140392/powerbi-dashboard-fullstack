/**
 * Competitor Mention Scanner
 *
 * Streams ratings.reviews, finds competitor brand mentions in review_text +
 * review_title, classifies surrounding sentiment via a small phrase list,
 * and upserts into ratings.competitor_mentions.
 *
 * This is the server-side replacement for the in-browser scan in
 * src/utils/competitorDetection.ts (which only sees the currently-rendered
 * review slice, so the UI used to read 0 mentions on most filters).
 *
 * Idempotent: ON CONFLICT (company_id, review_id, brand) preserves row id,
 * keeps scanned_at current. Designed to be wrapped as a Temporal activity
 * that runs after the daily sync.
 */
require('dotenv').config();
const { Pool } = require('pg');

function requireEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

const pool = new Pool({
    host: requireEnv('DB_HOST'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: 5,
});

const COMPANY_ID = requireEnv('COMPANY_ID');
const BATCH = parseInt(process.env.SCAN_BATCH || '5000', 10);

// Phrases that flip the sentiment of a competitor mention.
// Order matters — the longest most-specific patterns are checked first.
const PRESTIGE_BETTER = [
    'better than', 'much better than', 'superior to', 'way better than',
    'switched from', 'replaced my', 'replaced the', 'used to use', 'used to have',
    'prefer this over', 'prefer prestige over', 'outperforms',
    'better quality than', 'unlike',
];
const COMPETITOR_BETTER = [
    'not as good as', 'worse than', 'should have bought', 'should have got',
    'regret not buying', 'disappointed compared to', 'inferior to',
    'was better than this', 'is better than this',
];

function classifyContext(contextLower) {
    for (const p of PRESTIGE_BETTER) if (contextLower.includes(p)) return { sentiment: 'Positive', isFavorable: true };
    for (const p of COMPETITOR_BETTER) if (contextLower.includes(p)) return { sentiment: 'Negative', isFavorable: false };
    return { sentiment: 'Neutral', isFavorable: false };
}

// Find ALL non-overlapping word-boundary occurrences of `needle` in `hay`.
// Skips intra-word hits (matters for short brands like "iron" — never want
// it inside "ironing").
function findAllOccurrences(hay, needle) {
    const out = [];
    if (!needle || needle.length < 2) return out;
    const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'gi');
    let m;
    while ((m = re.exec(hay)) !== null) {
        out.push(m.index);
        if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
}

async function main() {
    console.log('=== Competitor mention scan ===');

    const brandsRes = await pool.query(`
        SELECT DISTINCT brand_name
        FROM masters.products
        WHERE company_id = $1
          AND is_competitor = true
          AND brand_name IS NOT NULL
          AND LENGTH(brand_name) >= 3
    `, [COMPANY_ID]);
    const brands = brandsRes.rows.map(r => r.brand_name).filter(b => b.toLowerCase() !== 'prestige');
    console.log(`Scanning for ${brands.length} competitor brands: ${brands.join(', ')}`);

    // For each brand also include a "Comparison" virtual brand for generic
    // "better than X" phrases that don't name a specific competitor.
    const cursor = await pool.connect();
    await cursor.query('BEGIN');
    await cursor.query(`DECLARE rev_cursor NO SCROLL CURSOR FOR
        SELECT id, web_pid, platform, COALESCE(review_title, '') || ' ' || COALESCE(review_text, '') AS body,
               review_date, rating
        FROM ratings.reviews
        WHERE company_id = $1
          AND COALESCE(review_text, '') <> ''
    `, [COMPANY_ID]);

    let totalRows = 0;
    let totalMentions = 0;

    while (true) {
        const { rows } = await cursor.query(`FETCH ${BATCH} FROM rev_cursor`);
        if (!rows.length) break;
        totalRows += rows.length;

        const params = [];
        const valuesSql = [];
        for (const r of rows) {
            const body = r.body || '';
            const bodyLower = body.toLowerCase();
            for (const brand of brands) {
                const positions = findAllOccurrences(body, brand);
                if (!positions.length) continue;
                const idx = positions[0];
                const start = Math.max(0, idx - 60);
                const end = Math.min(body.length, idx + brand.length + 60);
                const context = body.slice(start, end);
                const verdict = classifyContext(bodyLower);
                params.push(
                    COMPANY_ID, r.id, r.web_pid, r.platform, brand,
                    (start > 0 ? '...' : '') + context + (end < body.length ? '...' : ''),
                    verdict.sentiment, verdict.isFavorable, r.review_date, r.rating
                );
                const b = (valuesSql.length) * 10;
                valuesSql.push(
                    `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10})`
                );
            }
        }

        if (valuesSql.length) {
            await pool.query(`
                INSERT INTO ratings.competitor_mentions
                    (company_id, review_id, web_pid, platform, brand, context, sentiment, is_favorable, review_date, review_rating)
                VALUES ${valuesSql.join(',')}
                ON CONFLICT (company_id, review_id, brand) DO UPDATE
                  SET context = EXCLUDED.context,
                      sentiment = EXCLUDED.sentiment,
                      is_favorable = EXCLUDED.is_favorable,
                      review_date = EXCLUDED.review_date,
                      review_rating = EXCLUDED.review_rating,
                      scanned_at = NOW()
            `, params);
            totalMentions += valuesSql.length;
        }

        console.log(`Processed ${totalRows} reviews, ${totalMentions} mentions so far`);
    }

    await cursor.query('CLOSE rev_cursor');
    await cursor.query('COMMIT');
    cursor.release();

    console.log(`Scan complete. Reviews: ${totalRows}, mentions written: ${totalMentions}`);
    await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
