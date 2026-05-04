import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const rs = await queryClickHouse("DESCRIBE TABLE rb_product_verify");
        console.log("Columns:", rs.map(r => r.name).join(", "));
    } catch (e) {
        console.error(e.message);
    }
    process.exit(0);
}
run();
