import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT DISTINCT category 
            FROM rca_sku_dim 
            LIMIT 5
        `;
        const results = await queryClickHouse(query);
        console.log("rca_sku_dim Categories:", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
