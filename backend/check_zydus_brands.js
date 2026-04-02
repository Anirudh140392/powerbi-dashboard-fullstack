import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const brands = await queryClickHouse("SELECT DISTINCT brand_name FROM zydus.rca_sku_dim WHERE toString(comp_flag) = '0'");
        console.log("Our Brands:", JSON.stringify(brands, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
