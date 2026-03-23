import { queryClickHouse } from './src/config/clickhouse.js';
async function run() {
    try {
        console.log("Testing lowercase 's'...");
        const res1 = await queryClickHouse("SELECT Ad_sales FROM rb_pdp_olap LIMIT 1");
        console.log("Success with Ad_sales");
    } catch(e) {
        console.log("Failed with Ad_sales:", e.message);
    }
    try {
        console.log("Testing uppercase 'S'...");
        const res2 = await queryClickHouse("SELECT Ad_Sales FROM rb_pdp_olap LIMIT 1");
        console.log("Success with Ad_Sales");
    } catch(e) {
        console.log("Failed with Ad_Sales:", e.message);
    }
    process.exit(0);
}
run();
