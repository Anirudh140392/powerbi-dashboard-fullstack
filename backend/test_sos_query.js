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

        // Use a date range that likely has data based on the sample row (2025-11-18)
        const query = `
            SELECT 
                brand_name, 
                count() as brand_count
            FROM rb_kw
            WHERE toDate(created_on) BETWEEN '2025-11-01' AND '2025-11-30'
              AND keyword_search_rank < 11
            GROUP BY brand_name
            ORDER BY brand_count DESC
            LIMIT 10
        `;

        console.log('Running Query:', query);

        const result = await clickhouse.query({
            query,
            format: 'JSONEachRow',
        });
        const rows = await result.json();
        console.log('--- Brand Level SOS Results ---');
        console.table(rows);

        // Denominator Check
        const denomQuery = `
            SELECT count() as total_count
            FROM rb_kw
            WHERE toDate(created_on) BETWEEN '2025-11-01' AND '2025-11-30'
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
