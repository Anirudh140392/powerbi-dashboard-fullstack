
import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});
async function run() {
    try {
        // 1. Describe table
        const desc = await clickhouse.query({ query: 'DESCRIBE TABLE rb_pm_olap', format: 'JSONEachRow' });
        const cols = await desc.json();
        console.log('=== rb_pm_olap COLUMNS ===');
        cols.forEach(c => console.log(`  ${c.name} (${c.type})`));

        // 2. Sample keyword_type values
        const kwTypes = await clickhouse.query({
            query: `SELECT DISTINCT keyword_type FROM rb_pm_olap WHERE keyword_type IS NOT NULL LIMIT 20`,
            format: 'JSONEachRow'
        });
        const kwData = await kwTypes.json();
        console.log('\n=== DISTINCT keyword_type VALUES ===');
        kwData.forEach(r => console.log(`  "${r.keyword_type}"`));

        // 3. Sample data with impressions by keyword_type
        const sample = await clickhouse.query({
            query: `SELECT keyword_type, SUM(impressions) as total_imp, count() as cnt FROM rb_pm_olap WHERE keyword_type IS NOT NULL GROUP BY keyword_type ORDER BY total_imp DESC LIMIT 10`,
            format: 'JSONEachRow'
        });
        const sampleData = await sample.json();
        console.log('\n=== IMPRESSIONS BY keyword_type ===');
        sampleData.forEach(r => console.log(`  ${r.keyword_type}: ${r.total_imp} (${r.cnt} rows)`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
