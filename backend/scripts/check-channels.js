import { queryClickHouse } from '../src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT CHANNEL, count() 
            FROM rb_pdp_olap 
            WHERE Category != '' 
            AND toDate(DATE) > '2026-02-01'
            GROUP BY CHANNEL
        `;
        const results = await queryClickHouse(query);
        console.log("Channels with Category data (Recent):", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
