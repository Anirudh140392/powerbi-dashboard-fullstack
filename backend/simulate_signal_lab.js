import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

async function simulateSignalLab() {
    try {
        const start = '2025-09-01';
        const end = '2025-09-30';
        const compStart = '2025-08-01';
        const compEnd = '2025-08-31';

        const mainMetricExpr = `(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;
        const compMetricExpr = `(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;
        const metricExpr = `(ifNull(${mainMetricExpr}, 0) - ifNull(${compMetricExpr}, 0))`;

        const skuQuery = `
            SELECT Web_Pid, ${metricExpr} as sortMetric
            FROM rb_pdp_olap
            WHERE (toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')
                AND toString(Comp_flag) = '0'
            GROUP BY Web_Pid
            HAVING sortMetric < 0
            ORDER BY sortMetric ASC
            LIMIT 4 OFFSET 0
        `;

        console.log('Running simulated SKU query...');
        const result = await client.query({
            query: skuQuery,
            format: 'JSONEachRow'
        });
        const rows = await result.json();
        console.log('SKU Query Result:', JSON.stringify(rows, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

simulateSignalLab();
