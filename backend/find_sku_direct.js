import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB, // mamaearth
});

async function run() {
    try {
        const query = `
            SELECT DISTINCT Product, Web_Pid
            FROM rb_pdp_olap
            WHERE Product ILIKE '%hyaluronic%'
            LIMIT 50
        `;
        const result = await clickhouse.query({
            query,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log("Matching products:", data);
    } catch (err) {
        console.error('FAILED:', err);
    }
    process.exit(0);
}

run();
