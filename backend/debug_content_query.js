
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
});

async function runDebug() {
    try {
        console.log("🔍 Debugging Content Analysis Query...");

        // Simulate filters: Platform=Amazon, Date=2026-01-21
        const startDate = '2026-01-21';
        const endDate = '2026-01-21';
        const brand = 'All'; // or undefined
        const platform = 'Amazon';

        let query = `
            SELECT 
                count() as count
            FROM tb_content_score_data
            WHERE 1=1
        `;

        // Date Range
        query += ` AND toDate(extraction_timestamp) BETWEEN '${startDate}' AND '${endDate}'`;

        // Platform (URL logic)
        if (platform === 'Amazon') {
            query += ` AND url LIKE '%amazon%'`;
        }

        console.log("Executing Query:", query);

        const result = await clickhouse.query({ query: query, format: 'JSONEachRow' });
        const data = await result.json();
        console.log("✅ Result Count:", data);

        // Fetch a few actual rows to check columns
        let rowQuery = `
            SELECT *
            FROM tb_content_score_data
            WHERE toDate(extraction_timestamp) BETWEEN '${startDate}' AND '${endDate}'
            AND url LIKE '%amazon%'
            LIMIT 2
        `;
        console.log("Fetching sample rows...");
        const rowResult = await clickhouse.query({ query: rowQuery, format: 'JSONEachRow' });
        const rows = await rowResult.json();
        console.log("Rows:", JSON.stringify(rows, null, 2));

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

runDebug();
