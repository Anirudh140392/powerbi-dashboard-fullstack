import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const t1 = await queryClickHouse(`SELECT * FROM rb_sku_platform LIMIT 3`);
        console.log("rb_sku_platform:", t1);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
