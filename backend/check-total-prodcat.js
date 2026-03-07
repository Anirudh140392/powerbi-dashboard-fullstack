import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT count() 
            FROM rb_pdp_olap 
            WHERE Product_Category IS NOT NULL AND Product_Category != '' AND Product_Category != '0'
        `;
        const results = await queryClickHouse(query);
        console.log("Non-empty Product_Category count:", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
