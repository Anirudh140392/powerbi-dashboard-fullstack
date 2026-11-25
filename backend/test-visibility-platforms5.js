import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    const res = await queryClickHouse(`SELECT DISTINCT platform_name as platform FROM rb_kw_olap WHERE platform_name IN ('Amazon', 'Flipkart', 'amazon', 'flipkart')`);
    console.log(res);
}

test().catch(console.error);
