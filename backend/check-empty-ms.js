import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        console.log("Checking null/empty group_brand values:");
        const query = `
            SELECT 
                count(*) as total,
                countIf(group_brand = '') as empty_group_brand,
                countIf(brand = '') as empty_brand,
                countIf(item_name = '') as empty_item_name
            FROM rb_brand_ms
        `;
        const results = await queryClickHouse(query);
        console.log(JSON.stringify(results, null, 2));

    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
