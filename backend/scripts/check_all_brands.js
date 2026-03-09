import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function checkAllBrands() {
    try {
        const query = `
            SELECT 
                brand_name,
                count() as cnt
            FROM colpal.rb_kw
            WHERE toDate(created_on) = '2025-11-18'
              AND keyword_search_rank < 11
              AND platform_name = 'Blinkit'
            GROUP BY brand_name
            ORDER BY cnt DESC
            LIMIT 20
        `;

        const result = await clickhouse.query({
            query,
            format: 'JSONEachRow',
        });
        const rows = await result.json();
        console.table(rows);

        const total = `SELECT count() as total FROM colpal.rb_kw WHERE toDate(created_on) = '2025-11-18' AND keyword_search_rank < 11 AND platform_name = 'Blinkit'`;
        const tRes = await clickhouse.query({ query: total, format: 'JSONEachRow' });
        console.log('Total Count:', (await tRes.json())[0].total);

    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

checkAllBrands();
