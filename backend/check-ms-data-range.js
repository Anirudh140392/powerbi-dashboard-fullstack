import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        console.log("Checking date range and categories in rb_brand_ms:");
        const query = `
            SELECT 
                min(toDate(created_on)) as min_date, 
                max(toDate(created_on)) as max_date,
                count(*) as total_rows
            FROM rb_brand_ms
        `;
        const results = await queryClickHouse(query);
        console.log("Date Range:", results);

        const catQuery = `
            SELECT category, count(*) as count
            FROM rb_brand_ms
            GROUP BY category
            ORDER BY count DESC
            LIMIT 10
        `;
        const catResults = await queryClickHouse(catQuery);
        console.log("Top Categories:", catResults);

        const locQuery = `
            SELECT location, count(*) as count
            FROM rb_brand_ms
            GROUP BY location
            ORDER BY count DESC
            LIMIT 10
        `;
        const locResults = await queryClickHouse(locQuery);
        console.log("Top Locations:", locResults);

    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
