import 'dotenv/config';
import { createClient } from '@clickhouse/client';

async function test() {
    const dbs = ['boat', 'colpal', 'gcpl', 'cinthol', 'mars'];
    for (const db of dbs) {
        try {
            const client = createClient({
                url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
                username: process.env.CLICKHOUSE_USER || 'default',
                password: process.env.CLICKHOUSE_PASSWORD || '',
                database: db,
                request_timeout: 60000,
            });

            const query = `
            SELECT 
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sumNenoOsa,
                SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sumDenoOsa,
               SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullif(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0) * 100 as Osa
            FROM 
                rb_pdp_olap
            WHERE 
                DATE BETWEEN '2026-03-01' AND '2026-03-30' 
                AND Platform = 'Blinkit' AND Product= '1% Hyaluronic Sunscreen Aqua Gel'
                AND Comp_flag = 0 LIMIT 100
            `;
            const result = await client.query({ query, format: 'JSONEachRow' });
            const res = await result.json();
            if (res.length > 0 && res[0].sumDenoOsa > 0) {
                console.log(`==== DB ${db} has data ====`, res);

                const q2 = `
            SELECT Web_Pid as sku, Product as name, DATE as date, 
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno,
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullif(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0) * 100 as osa
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '2026-03-01' AND '2026-03-30'
            AND Platform = 'Blinkit' AND Product= '1% Hyaluronic Sunscreen Aqua Gel'
            AND Comp_flag = 0 AND Web_Pid IS NOT NULL AND Web_Pid != ''
            GROUP BY Web_Pid, Product, DATE
            ORDER BY DATE
            `;
                const result2 = await client.query({ query: q2, format: 'JSONEachRow' });
                const res2 = await result2.json();
                if (res2.length > 0) {
                    console.log(`DB ${db} daily data for 1% Hyaluronic Sunscreen Aqua Gel:`);
                    console.table(res2.slice(0, 50));
                }
            }

        } catch (e) {
            // ignore
        }
    }
}
test();
