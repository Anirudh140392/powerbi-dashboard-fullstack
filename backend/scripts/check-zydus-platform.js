import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    try {
        console.log("--- zydus.rb_sku_platform ---");
        const cols = await queryClickHouse(`SELECT name FROM system.columns WHERE database = 'zydus' AND table = 'rb_sku_platform'`);
        console.log(cols.map(c => c.name).join(', '));
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
