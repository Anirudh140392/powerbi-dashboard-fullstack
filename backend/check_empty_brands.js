import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function checkEmptyBrands() {
    try {
        const query = `
            SELECT 
                count() as total_count,
                countIf(brand_name IS NULL OR brand_name = '' OR trim(brand_name) = '') as empty_brand_count
            FROM colpal.rb_kw
            WHERE toDate(created_on) = '2025-11-18'
              AND keyword_search_rank < 11
              AND platform_name = 'Blinkit'
        `;

        const result = await clickhouse.query({
            query,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.table(data);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

checkEmptyBrands();
