import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT 
                count(Category) as cat_count, 
                count(Product_Category) as prod_cat_count 
            FROM rb_pdp_olap 
            WHERE toDate(DATE) > '2026-01-01'
        `;
        const results = await queryClickHouse(query);
        console.log("Counts:", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
