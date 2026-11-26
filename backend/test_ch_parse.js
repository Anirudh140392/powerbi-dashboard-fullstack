import { queryClickHouse } from './src/config/clickhouse.js';

async function testClickHouseParse() {
    try {
        const query1 = `SELECT toFloat64OrZero('1,000') as result1`;
        const res1 = await queryClickHouse(query1).catch(e => e.message);
        console.log('toFloat64OrZero string with comma:', res1);

        const query2 = `SELECT sum(toFloat64OrZero(replaceRegexpAll(toString(Sales), ',', ''))) as TS 
                        FROM rb_pdp_olap LIMIT 1`;
        const res2 = await queryClickHouse(query2);
        console.log('totalSales via regexp replace:', res2);

        const query3 = `SELECT sum(toFloat64(Sales)) as TS 
                        FROM rb_pdp_olap LIMIT 1`;
        const res3 = await queryClickHouse(query3).catch(e => e.message);
        console.log('totalSales via toFloat64:', res3);

    } catch (e) {
        console.error(e);
    }
}
testClickHouseParse();
