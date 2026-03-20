import { queryClickHouse } from './backend/src/config/clickhouse.js';

async function test() {
    try {
        const q1 = `
            SELECT 
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno,
                (SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0))) * 100 as osa
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2026-03-01' AND '2026-03-17'
        `;
        const r1 = await queryClickHouse(q1);
        console.log('Without comp_flag=0:', r1);

        const q2 = `
            SELECT 
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno,
                (SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0))) * 100 as osa
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2026-03-01' AND '2026-03-17'
            AND Comp_flag = 0
        `;
        const r2 = await queryClickHouse(q2);
        console.log('With comp_flag=0:', r2);
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
test();
