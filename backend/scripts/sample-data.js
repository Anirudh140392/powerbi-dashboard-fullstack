import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        console.log("--- Sample from Category (Recent) ---");
        const q1 = `SELECT DISTINCT Category FROM rb_pdp_olap WHERE toDate(DATE) > '2026-02-01' LIMIT 5`;
        const r1 = await queryClickHouse(q1);
        console.log(r1);

        console.log("--- Sample from Product_Category (Historical) ---");
        const q2 = `SELECT DISTINCT Product_Category FROM rb_pdp_olap WHERE Product_Category != '' LIMIT 5`;
        const r2 = await queryClickHouse(q2);
        console.log(r2);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
