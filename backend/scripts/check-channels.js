import { queryClickHouse } from '../src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT channel, count() 
            FROM rb_pdp_olap 
            WHERE Product_Category != '' 
            AND toDate(DATE) > '2026-02-01'
            GROUP BY channel
        `;
        const results = await queryClickHouse(query);
        console.log("Channels with Product_Category data (Recent):", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
