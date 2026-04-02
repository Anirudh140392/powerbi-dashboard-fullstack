import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const brands = await queryClickHouse("SELECT DISTINCT lower(group_brand) as brand FROM zydus.rb_ms_olap");
        console.log("Brands in MS Olap:", JSON.stringify(brands, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
