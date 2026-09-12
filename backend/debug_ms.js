import { queryClickHouse } from './backend/src/config/clickhouse.js';

async function test() {
    try {
        console.log("Checking columns in rb_brand_ms...");
        const columns = await queryClickHouse("DESCRIBE rb_brand_ms");
        console.log("Columns:", JSON.stringify(columns, null, 2));

        console.log("\nChecking sample data from rb_brand_ms...");
        const sample = await queryClickHouse("SELECT * FROM rb_brand_ms LIMIT 5");
        console.log("Sample Data:", JSON.stringify(sample, null, 2));

        console.log("\nChecking distinct group_brand, brand, item_name...");
        const counts = await queryClickHouse("SELECT count() FROM rb_brand_ms WHERE group_brand != '' AND brand != '' AND item_name != ''");
        console.log("Count of valid rows:", counts[0]['count()']);

    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
