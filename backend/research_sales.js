import { createClient } from '@clickhouse/client';
import 'dotenv/config';

async function run() {
    const client = createClient({
        url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
        database: 'mars',
    });

    try {
        const query = `
            SELECT
                p.DATE AS date,
                any(po.platform_offtake) AS offtake
            FROM rb_pdp_olap p
            LEFT JOIN (
                SELECT DATE, Platform, sum(ifNull(toFloat64OrZero(toString(Sales)), 0)) as platform_offtake 
                FROM rb_pdp_olap 
                WHERE DATE BETWEEN '2026-03-01' AND '2026-03-31'
                GROUP BY DATE, Platform
            ) po ON p.DATE = po.DATE AND p.Platform = po.Platform
            WHERE p.DATE = '2026-03-29'
              AND p.Platform = 'Blinkit'
            GROUP BY p.DATE
        `;
        const res = await client.query({ query, format: 'JSONEachRow' });
        const data = await res.json();
        console.log("March 29th Result (AFTER ALIAS FIX):", data);
    } catch (e) {
        console.error("Query ERROR:", e.message);
    }
}

run();
