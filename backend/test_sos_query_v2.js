import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function testSosQuery() {
    try {
        console.log(`Connecting to ${process.env.CLICKHOUSE_URL} (DB: ${process.env.CLICKHOUSE_DB})...`);

        // Single day to ensure speed
        const query = `
            SELECT 
                brand_name, 
                count() as brand_count
            FROM rb_kw
            WHERE toDate(created_on) = '2025-11-18'
              AND keyword_search_rank < 11
            GROUP BY brand_name
            ORDER BY brand_count DESC
            LIMIT 5
        `;

        console.log('Running Query:', query);

        const result = await clickhouse.query({
            query,
            format: 'JSONEachRow',
        });
        const rows = await result.json();
        console.log('--- Brand Level SOS Results (Single Day) ---');
        console.table(rows);

        // Denominator Check
        const denomQuery = `
            SELECT count() as total_count
            FROM rb_kw
            WHERE toDate(created_on) = '2025-11-18'
              AND keyword_search_rank < 11
        `;
        const denomResult = await clickhouse.query({
            query: denomQuery,
            format: 'JSONEachRow',
        });
        const denomRows = await denomResult.json();
        console.log('Denominator:', denomRows[0].total_count);

    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

testSosQuery();
