import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        const res = await queryClickHouse(`SELECT SUM(ifNull(toFloat64OrZero(toString(Ad_Quantity_sold)), 0)) as orders, SUM(ifNull(toFloat64OrZero(toString(ad_click)), 0)) as clicks FROM rb_pm_olap where Platform='Instamart' AND DATE='2026-03-18'`);
        console.log(res);
        const res2 = await queryClickHouse(`SELECT brand FROM rb_pm_olap where Platform='Instamart' AND DATE='2026-03-18' LIMIT 5`);
        console.log(res2);
    } catch (e) {
        console.error(e);
    }
}
test();
