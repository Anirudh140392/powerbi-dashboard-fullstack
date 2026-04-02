import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const cats = await queryClickHouse("SELECT DISTINCT category FROM zydus.rb_ms_olap");
        console.log("Categories in MS Olap:", JSON.stringify(cats, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
