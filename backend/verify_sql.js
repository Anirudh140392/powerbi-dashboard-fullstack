
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

async function verifySql() {
    try {
        console.log('--- Direct SQL Verification of Category Filtering ---');
        
        // 1. Standard Case
        const res1 = await clickhouse.query({
            query: "SELECT count(*) as count FROM rb_kw_olap WHERE keyword_category = 'Chocolates (Non Gifting)' AND DATE BETWEEN '2026-02-15' AND '2026-02-21'",
            format: 'JSONEachRow'
        });
        const count1 = (await res1.json())[0].count;
        console.log(`Count (Standard Case): ${count1}`);

        // 2. Case Insensitive (using my new logic)
        const res2 = await clickhouse.query({
            query: "SELECT count(*) as count FROM rb_kw_olap WHERE LOWER(keyword_category) IN ('chocolates (non gifting)') AND DATE BETWEEN '2026-02-15' AND '2026-02-21'",
            format: 'JSONEachRow'
        });
        const count2 = (await res2.json())[0].count;
        console.log(`Count (Case Insensitive): ${count2}`);

        if (count1 === count2 && count1 > 0) {
            console.log('✅ SUCCESS: Case-insensitive SQL logic works correctly.');
        } else {
            console.log('❌ FAILURE: Counts do not match or are zero.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verifySql();
