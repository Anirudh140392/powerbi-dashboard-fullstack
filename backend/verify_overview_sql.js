
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@clickhouse/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

async function verifyOverviewSql() {
    try {
        console.log('--- Direct SQL Verification for Visibility Overview Category ---');
        
        const dateFrom = '2026-02-15';
        const dateTo = '2026-02-21';
        const category = 'Chocolates (Non Gifting)';

        // 1. All Categories
        const resAll = await clickhouse.query({
            query: `
                SELECT 
                    ROUND(countIf(overall = 1 AND flag = '1') * 100.0 / nullIf(count(*), 0), 2) AS overall_sos
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
            `,
            format: 'JSONEachRow'
        });
        const valAll = (await resAll.json())[0].overall_sos;
        console.log(`Overall SOS (All Categories): ${valAll}`);

        // 2. Filtered by Category (Case-Insensitive logic)
        const resCat = await clickhouse.query({
            query: `
                SELECT 
                    ROUND(countIf(overall = 1 AND flag = '1') * 100.0 / nullIf(count(*), 0), 2) AS overall_sos
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND LOWER(keyword_category) IN ('${category.toLowerCase()}')
            `,
            format: 'JSONEachRow'
        });
        const valCat = (await resCat.json())[0].overall_sos;
        console.log(`Overall SOS (Filtered by ${category}): ${valCat}`);

        if (valAll != valCat) {
            console.log('\n✅ SUCCESS: SQL filtering works correctly.');
        } else {
            console.log('\n❌ FAILURE: SQL Filtering did NOT change the results. Check column name or data.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verifyOverviewSql();
