import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const client = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: 'drl',
});

async function run() {
    try {
        console.log('Querying daily neno/deno counts for Amazon...');
        const result = await client.query({
            query: `
                SELECT 
                    DATE, 
                    COUNT() as cnt,
                    SUM(toFloat64OrZero(toString(neno_osa))) as neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as deno,
                    SUM(toFloat64OrZero(toString(neno_osa))) / SUM(toFloat64OrZero(toString(deno_osa))) as calculated_osa,
                    SUM(Comp_flag = 0) as own_brand_cnt,
                    SUM(Comp_flag = 1) as comp_brand_cnt,
                    Reseller_Name
                FROM rb_pdp_olap 
                WHERE lower(Platform) = 'amazon'
                GROUP BY DATE, Reseller_Name
                ORDER BY DATE DESC
                LIMIT 40
            `,
            format: 'JSONEachRow'
        });
        const rows = await result.json();
        console.log('RESULTS:', JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await client.close();
    }
}

run();
