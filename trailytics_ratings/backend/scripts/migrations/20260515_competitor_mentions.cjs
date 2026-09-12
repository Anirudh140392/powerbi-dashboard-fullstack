/**
 * Migration: ratings.competitor_mentions
 *
 * The original "competitor mentions" surface scanned every loaded review in
 * the browser. That stops working once the corpus exceeds a few thousand
 * reviews (and the page-level review list is already truncated/filtered).
 *
 * This table is the server-side equivalent: one row per (review, competitor
 * brand) match, with the surrounding context snippet, sentiment hint and
 * a favourable flag. Backfilled by scripts/scan_competitor_mentions.cjs and
 * kept in sync nightly by the same activity the daily Temporal pipeline runs.
 */
require('dotenv').config();
const { Client } = require('pg');

const SQL = `
CREATE TABLE IF NOT EXISTS ratings.competitor_mentions (
    id              BIGSERIAL PRIMARY KEY,
    company_id      UUID NOT NULL,
    review_id       UUID NOT NULL,
    web_pid         TEXT,
    platform        TEXT,
    brand           TEXT NOT NULL,
    context         TEXT NOT NULL,
    sentiment       TEXT NOT NULL DEFAULT 'Neutral',
    is_favorable    BOOLEAN NOT NULL DEFAULT false,
    review_date     DATE,
    review_rating   NUMERIC(3,2),
    scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, review_id, brand)
);
CREATE INDEX IF NOT EXISTS competitor_mentions_company_brand_idx
    ON ratings.competitor_mentions (company_id, brand);
CREATE INDEX IF NOT EXISTS competitor_mentions_company_date_idx
    ON ratings.competitor_mentions (company_id, review_date DESC);
`;

async function main() {
    const client = new Client({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
    });
    await client.connect();
    await client.query(SQL);
    console.log('competitor_mentions migration applied');
    await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
