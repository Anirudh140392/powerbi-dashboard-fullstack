import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    try {
        console.log("--- rca_sku_dim ---");
        const res1 = await queryClickHouse('DESCRIBE TABLE rca_sku_dim');
        console.table(res1.map(r => ({ name: r.name, type: r.type })));

        console.log("\n--- rb_pdp_olap ---");
        const res2 = await queryClickHouse('DESCRIBE TABLE rb_pdp_olap');
        console.table(res2.map(r => ({ name: r.name, type: r.type })));

        console.log("\n--- rb_sku_platform ---");
        const res3 = await queryClickHouse('DESCRIBE TABLE rb_sku_platform');
        console.table(res3.map(r => ({ name: r.name, type: r.type })));

        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
