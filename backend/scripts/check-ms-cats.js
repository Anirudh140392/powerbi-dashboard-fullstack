import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT DISTINCT category 
            FROM rb_brand_ms 
            WHERE toDate(created_on) > '2026-02-01'
        `;
        const results = await queryClickHouse(query);
        console.log("rb_brand_ms Categories:", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
