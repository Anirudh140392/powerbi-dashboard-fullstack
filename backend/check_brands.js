const { queryClickHouse } from './src/config/clickhouse.js';
import { getCurrentDbName } from './src/config/clickhouse.js';

async function check() {
    try {
        const db = getCurrentDbName();
        console.log('DB:', db);
        const res = await queryClickHouse(`SELECT Brand, count() as count, sum(toInt64OrZero(toString(neno_osa))) as neno, sum(toInt64OrZero(toString(deno_osa))) as deno FROM rb_pdp_olap WHERE Comp_flag = 1 GROUP BY Brand LIMIT 10`);
        console.log('Competitors:', res);
        
        const resOwn = await queryClickHouse(`SELECT Brand, count() as count, sum(toInt64OrZero(toString(neno_osa))) as neno, sum(toInt64OrZero(toString(deno_osa))) as deno FROM rb_pdp_olap WHERE Comp_flag = 0 GROUP BY Brand LIMIT 10`);
        console.log('Own Brands:', resOwn);
    } catch (e) {
        console.error(e);
    }
}
check();
