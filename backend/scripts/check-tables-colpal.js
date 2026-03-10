import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    try {
        console.log("--- Tables in colpal ---");
        const results = await queryClickHouse("SHOW TABLES FROM colpal");
        console.table(results);
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
