require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.VERCEL ? { rejectUnauthorized: false } : false,
});

// Root cause: the source MySQL table rb_crawl_review_info uses star_rating = 0
// as a sentinel for "couldn't parse a rating" (1,225 such rows on Amazon).
// The sync did Number(star_rating) and let 0 through as if it were a real
// rating, polluting every AVG/distribution calculation downstream. The BERT
// inference path also wrote 0 for original_user_rating when the user rating
// was NULL.
//
// This migration:
//   1) Drops NOT NULL on ratings.reviews.rating so it can hold "unknown".
//   2) Backfills the existing bad 0s to NULL on rating + ml_inferred_rating.
//   3) Adds CHECK constraints so future writes can't reintroduce the issue.
//
// The source-side fixes (sync_mysql_reviews.cjs, db_ml_backfill.py,
// bert_rating_inference.py, /api/ml-audit/approve) are committed separately.
const ddl = `
SET lock_timeout = '15s';

ALTER TABLE ratings.reviews ALTER COLUMN rating DROP NOT NULL;

UPDATE ratings.reviews SET rating = NULL
  WHERE rating IS NOT NULL AND (rating < 1 OR rating > 5);

UPDATE ratings.reviews SET ml_inferred_rating = NULL
  WHERE ml_inferred_rating IS NOT NULL AND (ml_inferred_rating < 1 OR ml_inferred_rating > 5);

ALTER TABLE ratings.reviews
  ADD CONSTRAINT reviews_rating_range
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)) NOT VALID;

ALTER TABLE ratings.reviews
  ADD CONSTRAINT reviews_ml_inferred_rating_range
  CHECK (ml_inferred_rating IS NULL OR (ml_inferred_rating >= 1 AND ml_inferred_rating <= 5)) NOT VALID;

ALTER TABLE ratings.reviews VALIDATE CONSTRAINT reviews_rating_range;
ALTER TABLE ratings.reviews VALIDATE CONSTRAINT reviews_ml_inferred_rating_range;
`;

async function main() {
    await client.connect();
    await client.query(ddl);
    console.log('Rating cleanup + range constraints applied.');
    await client.end();
}

main().catch(async (error) => {
    console.error('Failed to clean rating zeros:', error);
    try { await client.end(); } catch {}
    process.exit(1);
});
