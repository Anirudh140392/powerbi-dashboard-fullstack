import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    const data = await queryClickHouse(`SELECT min(toDate(DATE)) as minD, max(toDate(DATE)) as maxD FROM rb_pdp_olap WHERE Platform IN ('Amazon', 'Blinkit', 'Instamart')`);
    console.log(data);
    const count = await queryClickHouse(`SELECT count() FROM rb_pdp_olap WHERE Platform IN ('Amazon', 'Blinkit', 'Instamart') AND toDate(DATE) BETWEEN '2026-03-28' AND '2026-04-27'`);
    console.log("Count with dates:", count);

    // what if we remove platform filter?
    const count2 = await queryClickHouse(`SELECT count() FROM rb_pdp_olap WHERE toDate(DATE) BETWEEN '2026-03-28' AND '2026-04-27'`);
    console.log("Count with only dates:", count2);

    process.exit(0);
}
test();
