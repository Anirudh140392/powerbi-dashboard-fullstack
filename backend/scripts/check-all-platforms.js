import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT Platform, Category, count() 
            FROM rb_pdp_olap 
            WHERE toDate(DATE) > '2026-02-01'
            GROUP BY Platform, Category
            ORDER BY Platform, Category
        `;
        const results = await queryClickHouse(query);
        console.log("All Platforms Category values:", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
