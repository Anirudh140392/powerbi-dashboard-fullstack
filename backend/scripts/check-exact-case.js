import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const tables = ['rca_sku_dim', 'rb_pdp_olap', 'rb_sku_platform'];
        for (const table of tables) {
            console.log(`\n--- ${table} ---`);
            const results = await queryClickHouse(`SELECT name FROM system.columns WHERE database = 'colpal' AND table = '${table}'`);
            results.forEach(r => {
                if (r.name.toLowerCase().includes('category') || r.name.toLowerCase().includes('brand')) {
                     console.log(`Column: "${r.name}"`);
                }
            });
        }
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
