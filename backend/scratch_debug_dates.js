import { queryClickHouse, dbStorage } from './src/config/clickhouse.js';

async function run() {
    dbStorage.run({ dbName: 'drl' }, async () => {
        try {
            console.log('--- Amazon OSA Comparison by Date ---');
            const data = await queryClickHouse(`
                SELECT DATE,
                       SUM(toFloat64OrZero(toString(neno_osa))) as amz_neno,
                       SUM(toFloat64OrZero(toString(deno_osa))) as amz_deno,
                       SUM(IF(Reseller_Name = 'buy more', toFloat64OrZero(toString(neno_osa)), 0)) as buymore_neno,
                       SUM(IF(Reseller_Name = 'buy more', toFloat64OrZero(toString(deno_osa)), 0)) as buymore_deno
                FROM rb_pdp_olap
                WHERE lower(Platform) = 'amazon'
                GROUP BY DATE
                ORDER BY DATE DESC
                LIMIT 15
            `);
            data.forEach(r => {
                const amzOsa = r.amz_deno > 0 ? (r.amz_neno / r.amz_deno) * 100 : 0;
                const buyMoreOsa = r.buymore_deno > 0 ? (r.buymore_neno / r.buymore_deno) * 100 : 0;
                console.log(`${r.DATE} | Amazon: ${amzOsa.toFixed(2)}% (${r.amz_neno}/${r.amz_deno}) | Buy More: ${buyMoreOsa.toFixed(2)}% (${r.buymore_neno}/${r.buymore_deno})`);
            });
        } catch (e) {
            console.error('Error:', e);
        }
    });
}
run();
