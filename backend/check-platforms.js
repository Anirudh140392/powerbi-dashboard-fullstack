import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        console.log("Checking platforms in rb_brand_ms:");
        const query = `
            SELECT platform, count(*) as count
            FROM rb_brand_ms
            GROUP BY platform
        `;
        const results = await queryClickHouse(query);
        console.log(JSON.stringify(results, null, 2));

    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
