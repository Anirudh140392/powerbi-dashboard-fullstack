import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        console.log("Checking group_brand and brand relationship:");
        const query = `
            SELECT group_brand, brand, count(*) as count
            FROM rb_brand_ms
            WHERE group_brand != ''
            GROUP BY group_brand, brand
            ORDER BY count DESC
            LIMIT 10
        `;
        const results = await queryClickHouse(query);
        console.log(JSON.stringify(results, null, 2));

        console.log("\nChecking brand and sub_brand relationship:");
         const query2 = `
            SELECT brand, sub_brand, count(*) as count
            FROM rb_brand_ms
            WHERE sub_brand != ''
            GROUP BY brand, sub_brand
            ORDER BY count DESC
            LIMIT 10
        `;
        const results2 = await queryClickHouse(query2);
        console.log(JSON.stringify(results2, null, 2));

    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
