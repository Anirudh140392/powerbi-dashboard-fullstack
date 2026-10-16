import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        console.log("Inspecting first 5 rows of rb_brand_ms:");
        const query = `
            SELECT 
                group_brand, 
                brand, 
                item_name, 
                category, 
                location, 
                created_on,
                toDate(created_on) as created_date
            FROM rb_brand_ms
            LIMIT 5
        `;
        const results = await queryClickHouse(query);
        console.log(JSON.stringify(results, null, 2));

    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
