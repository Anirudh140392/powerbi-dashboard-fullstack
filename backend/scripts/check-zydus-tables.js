import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    try {
        const res = await queryClickHouse("SHOW TABLES FROM zydus");
        console.table(res);
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
