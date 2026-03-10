import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    try {
        console.log("--- rca_sku_dim ---");
        const query = `
            SELECT name, type 
            FROM system.columns 
            WHERE database = 'colpal' AND table = 'rca_sku_dim'
        `;
        const results = await queryClickHouse(query);
        console.table(results);
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
