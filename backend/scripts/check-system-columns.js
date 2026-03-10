import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    try {
        const tables = ['rca_sku_dim', 'rb_pdp_olap', 'rb_sku_platform', 'rb_location_darkstore'];
        for (const table of tables) {
            console.log(`\n--- ${table} ---`);
            const query = `
                SELECT name, type 
                FROM system.columns 
                WHERE database = 'colpal' AND table = '${table}'
            `;
            const results = await queryClickHouse(query);
            console.table(results);
        }
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
