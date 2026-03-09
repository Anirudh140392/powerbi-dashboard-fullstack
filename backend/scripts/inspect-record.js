import { queryClickHouse } from '../src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT * 
            FROM rb_pdp_olap 
            WHERE toDate(DATE) > '2026-02-01'
            LIMIT 1
        `;
        const results = await queryClickHouse(query);
        console.log("Full Record (Recent):", results[0]);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
