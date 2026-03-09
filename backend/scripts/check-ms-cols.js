import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `DESCRIBE rb_brand_ms`;
        const results = await queryClickHouse(query);
        console.log("rb_brand_ms Columns:", results.map(r => r.name));
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
