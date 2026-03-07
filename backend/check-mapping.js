import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT DISTINCT brand_name, category 
            FROM rca_sku_dim 
            WHERE brand_name IS NOT NULL AND brand_name != ''
        `;
        const results = await queryClickHouse(query);
        console.log("Brand to Category Mapping:", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
