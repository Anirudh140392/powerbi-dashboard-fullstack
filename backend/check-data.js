import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

(async () => {
    try {
        const query = `
            SELECT Product_Category, count() 
            FROM rb_pdp_olap 
            WHERE toDate(DATE) BETWEEN '2026-02-01' AND '2026-03-07'
            GROUP BY Product_Category 
            LIMIT 10
        `;
        const results = await queryClickHouse(query);
        console.log("Sample Categories:", results);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
