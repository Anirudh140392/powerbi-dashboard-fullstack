import { queryClickHouse } from '../src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT toDate(DATE) as d, count() 
            FROM rb_pdp_olap 
            WHERE Product_Category != '' 
            AND toDate(DATE) > '2025-10-01'
            GROUP BY d 
            ORDER BY d DESC 
            LIMIT 5
        `;
        const results = await queryClickHouse(query);
        console.log("Last dates with Product_Category data:", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
