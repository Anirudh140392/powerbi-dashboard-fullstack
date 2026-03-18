import { queryClickHouse } from './src/services/clickhouse.js';
async function run() {
    try {
        const r1 = await queryClickHouse("SELECT keyword_search_product, brand_name_th, count() FROM rb_kw_olap WHERE keyword_search_product != '' AND POSITION < 11 GROUP BY keyword_search_product, brand_name_th LIMIT 20");
        console.log("Distribution:", r1);
        const r2 = await queryClickHouse("SELECT DISTINCT keyword FROM rb_kw_olap WHERE keyword_search_product != '' LIMIT 5");
        console.log("Keywords:", r2);
        process.exit(0);
    } catch(e) {
        console.log(e);
        process.exit(1);
    }
}
run();
