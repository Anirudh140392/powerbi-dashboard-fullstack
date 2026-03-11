import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        const query = `
            SELECT 
                min(toDate(created_on)) as min_date, 
                max(toDate(created_on)) as max_date
            FROM rb_brand_ms
        `;
        const results = await queryClickHouse(query);
        console.log("Full Date Range:", JSON.stringify(results, null, 2));

        const catQuery = `
            SELECT DISTINCT category
            FROM rb_brand_ms
            LIMIT 50
        `;
        const cats = await queryClickHouse(catQuery);
        console.log("Available Categories:", cats.map(c => c.category));

    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
