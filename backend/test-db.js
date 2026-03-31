import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const res1 = await queryClickHouse(`SELECT DISTINCT Platform FROM rb_pdp_olap`);
        console.log("Platforms in MV (rb_pdp_olap):", res1.map(r => r.Platform));

        const res2 = await queryClickHouse(`SELECT DISTINCT Platform FROM rb_kw_olap`);
        console.log("Platforms in raw (rb_kw_olap):", res2.map(r => r.Platform));

        const res3 = await queryClickHouse(`SELECT DISTINCT platform_name FROM rb_kw_olap`);
        console.log("Platform_names in rb_kw_olap:", res3.map(r => r.platform_name));

        const res4 = await queryClickHouse(`
            SELECT Platform, SUM(toFloat64OrZero(toString(sales))) as sales
            FROM rb_pdp_olap 
            WHERE toDate(DATE) BETWEEN '2026-02-01' AND '2026-02-28' 
            GROUP BY Platform
        `);
        console.log("Sales in Feb 2026 by platform:", res4);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
