import { queryClickHouse } from '../src/config/clickhouse.js';

(async () => {
    try {
        const query = `DESCRIBE rb_pdp_olap`;
        const results = await queryClickHouse(query);
        console.log("Columns:", results.map(r => r.name));
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
