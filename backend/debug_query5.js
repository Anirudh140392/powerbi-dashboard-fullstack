import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const desc = await queryClickHouse(`DESCRIBE TABLE rca_sku_dim`);
        console.log("rca_sku_dim schema:", desc);

        const smpl = await queryClickHouse(`SELECT * FROM rca_sku_dim LIMIT 3`);
        console.log("Sample:", smpl);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
