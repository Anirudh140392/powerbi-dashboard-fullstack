/**
 * Apply the pending reviews_ml_audit classifications to ratings.reviews.
 *
 * ~2.9M reviews were classified by the DeBERTa/BERT pipeline into
 * ratings.reviews_ml_audit but never applied (the per-review approval step never
 * cleared), so the dashboard's sentiment/issue/ML-rating panels ran on ~14% of
 * reviews and recent months were ~0%. This applies them.
 *
 * Quality safeguards (sample-verified):
 *  - Only fills NULL fields (idempotent; never overwrites human/existing values).
 *  - sentiment is reconciled with the star rating: 1-2 star => Negative (the
 *    star is ground truth and the model mislabelled some clear negatives as
 *    Positive/Neutral, ~5% conflict rate); 3-5 star keeps the model's sentiment.
 *  - Processes by reviews_ml_audit.id ranges (pkey range scan) so it's fast and
 *    resumable — safe to re-run / stop / continue.
 *
 * READ the rule above before running. SELECT/UPDATE only on ratings.reviews.
 */
require('dotenv').config();
const { Pool } = require('pg');

// COMPANY_ID env is how the Temporal worker (runNodeScript) passes the company;
// argv is for manual runs. Falls back to Prestige.
const COMPANY = process.argv[2] || process.env.COMPANY_ID || '297e37ea-a5ac-47df-bebd-ac44e52b7979';
const STEP = parseInt(process.env.APPLY_BATCH || '25000', 10);

(async () => {
    const pool = new Pool({
        host: process.env.DB_HOST, database: process.env.DB_NAME, user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
            ? { rejectUnauthorized: false } : false,
    });

    const before = await pool.query(
        `SELECT count(sentiment_category) sc, count(ml_inferred_rating) mlr, count(*) total
         FROM ratings.reviews WHERE company_id = $1`, [COMPANY]);
    console.log(`BEFORE: sentiment_category ${before.rows[0].sc}/${before.rows[0].total}, ml_rating ${before.rows[0].mlr}/${before.rows[0].total}`);

    // reviews_ml_audit.id is a UUID — keyset-paginate over it (btree-ordered).
    let lastId = '00000000-0000-0000-0000-000000000000';
    let applied = 0, scanned = 0, batches = 0;
    while (true) {
        const r = await pool.query(`
            WITH batch AS (
                SELECT id, review_id, ml_issue_category, ml_issue_subcategory, ml_issue,
                       ml_inferred_rating, ml_sentiment
                FROM ratings.reviews_ml_audit
                WHERE company_id = $1 AND id > $2::uuid AND ml_issue_category IS NOT NULL
                ORDER BY id
                LIMIT $3
            ),
            upd AS (
                UPDATE ratings.reviews rv SET
                    sentiment_category    = COALESCE(rv.sentiment_category, b.ml_issue_category),
                    sentiment_subcategory = COALESCE(rv.sentiment_subcategory, b.ml_issue_subcategory),
                    specific_issue        = COALESCE(rv.specific_issue, b.ml_issue_subcategory, b.ml_issue),
                    ml_inferred_rating    = COALESCE(rv.ml_inferred_rating, b.ml_inferred_rating),
                    sentiment             = COALESCE(rv.sentiment,
                                              CASE WHEN rv.rating <= 2 THEN 'Negative' ELSE b.ml_sentiment END),
                    updated_at = now()
                FROM batch b
                WHERE b.review_id = rv.id AND rv.company_id = $1
                  AND (rv.sentiment_category IS NULL OR rv.ml_inferred_rating IS NULL OR rv.sentiment IS NULL)
                RETURNING 1
            )
            SELECT (SELECT id FROM batch ORDER BY id DESC LIMIT 1) AS maxid,
                   (SELECT count(*) FROM batch) AS nbatch,
                   (SELECT count(*) FROM upd)   AS nupd
        `, [COMPANY, lastId, STEP]);
        const { maxid, nbatch, nupd } = r.rows[0];
        if (!nbatch || Number(nbatch) === 0) break;
        lastId = maxid;
        applied += Number(nupd); scanned += Number(nbatch); batches++;
        if (batches % 10 === 0 || Number(nupd) > 0) process.stdout.write(`  batch ${batches}: scanned ${scanned}, applied ${applied}\n`);
    }

    const after = await pool.query(
        `SELECT count(sentiment_category) sc, count(ml_inferred_rating) mlr, count(*) total
         FROM ratings.reviews WHERE company_id = $1`, [COMPANY]);
    console.log(`AFTER: sentiment_category ${after.rows[0].sc}/${after.rows[0].total}, ml_rating ${after.rows[0].mlr}/${after.rows[0].total}`);
    console.log(`Applied ${applied} review updates.`);
    await pool.end();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
