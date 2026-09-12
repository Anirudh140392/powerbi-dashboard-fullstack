import { queryClickHouse } from '../backend/src/config/clickhouse.js';

async function test() {
    try {
        const query1 = `SELECT SUM(sales) as sum FROM mamaearth.rb_ms_olap where platform='blinkit' AND created_on BETWEEN '2026-05-01' AND '2026-05-31'`;
        const res1 = await queryClickHouse(query1);
        console.log("mamaearth May 1 to May 31 sales:", res1);

        const query2 = `SELECT SUM(sales) as sum FROM mamaearth.rb_ms_olap where platform='blinkit' AND created_on BETWEEN '2026-05-23' AND '2026-05-31'`;
        const res2 = await queryClickHouse(query2);
        console.log("mamaearth May 23 to May 31 sales:", res2);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

test();
