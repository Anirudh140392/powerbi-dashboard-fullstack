import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `DESCRIBE rca_sku_dim`;
        const results = await queryClickHouse(query);
        console.log("rca_sku_dim Columns:", results.map(r => r.name));
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
