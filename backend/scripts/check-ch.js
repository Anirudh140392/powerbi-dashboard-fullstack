import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    console.log("Checking ClickHouse connection...");
    try {
        const start = Date.now();
        const res = await queryClickHouse('SELECT 1');
        console.log("SELECT 1 took:", Date.now() - start, "ms");
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
