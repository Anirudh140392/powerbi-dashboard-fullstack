import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT DISTINCT Brand 
            FROM rb_pdp_olap 
            WHERE toDate(DATE) > '2026-02-01'
        `;
        const results = await queryClickHouse(query);
        console.log("Brands in rb_pdp_olap (Recent):", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
