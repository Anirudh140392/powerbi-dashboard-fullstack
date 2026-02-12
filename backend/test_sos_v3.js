import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function testSosV3() {
    try {
        console.log('Testing Refined SOS Query...');

        const query = `
            SELECT 
                brand_name,
                countIf(keyword_is_rb_product = 1 OR brand_name NOT IN ('Colgate', 'Palmolive', 'Halo', 'Perfora')) as brand_count,
                ROUND(brand_count * 100.0 / SUM(count(*)) OVER(), 2) as sos_percentage
            FROM colpal.rb_kw
            WHERE toDate(created_on) = '2025-11-18'
              AND keyword_search_rank < 11
              AND platform_name = 'Blinkit'
            GROUP BY brand_name
            HAVING brand_count > 0
            ORDER BY sos_percentage DESC
            LIMIT 10
        `;

        const result = await clickhouse.query({
            query,
            format: 'JSONEachRow',
        });
        const rows = await result.json();
        console.table(rows);

    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

testSosV3();
