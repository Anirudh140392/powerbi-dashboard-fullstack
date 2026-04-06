import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const brands = await queryClickHouse("SELECT DISTINCT group_brand FROM zydus.rb_ms_olap WHERE category = 'Salt, Sugar & Jaggery' LIMIT 10");
        console.log("Brands for Salt, Sugar & Jaggery:", brands);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
