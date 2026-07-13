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

// Per-field source tracking on the contested fields. The ML backfill silently
// overwrote manual user edits because there was no provenance. Each writer
// now stamps the relevant source; the sync script and ML approver respect
// 'user' as a write-lock and don't clobber it.
//
// No backfill on existing rows — leaving them NULL is correct: NULL doesn't
// match 'user' so it doesn't block writes. New writes by the sync/edit/approve
// paths will populate the columns going forward.
const ddl = `
-- ALTER needs ACCESS EXCLUSIVE on a busy 567K-row table; lock_timeout makes
-- the migration fail fast (5s) rather than queueing behind reads and blocking
-- every dashboard query waiting on the table.
SET lock_timeout = '5s';

ALTER TABLE ratings.reviews
    ADD COLUMN IF NOT EXISTS category_source       text,
    ADD COLUMN IF NOT EXISTS sentiment_source      text,
    ADD COLUMN IF NOT EXISTS specific_issue_source text;
`;

async function main() {
    await client.connect();
    await client.query(ddl);
    console.log('Review source tracking columns ready.');
    await client.end();
}

main().catch(async (error) => {
    console.error('Failed to add source-tracking columns:', error);
    try { await client.end(); } catch {}
    process.exit(1);
});
