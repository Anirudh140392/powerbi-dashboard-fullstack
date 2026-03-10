import { queryClickHouse } from '../src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT count() 
            FROM rb_pdp_olap 
            WHERE Category IS NOT NULL AND Category != '' AND Category != '0'
        `;
        const results = await queryClickHouse(query);
        console.log("Non-empty Category count:", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
