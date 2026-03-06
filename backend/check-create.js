import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const tables = ['rca_sku_dim', 'rb_sku_platform'];
        for (const table of tables) {
            console.log(`\n--- ${table} ---`);
            const res = await queryClickHouse(`SHOW CREATE TABLE ${table}`);
            console.log(res[0].statement);
        }
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
