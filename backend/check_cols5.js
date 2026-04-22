import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        let res = await queryClickHouse("SELECT page_url FROM rb_sku_platform WHERE page_url IS NOT NULL AND page_url != '' LIMIT 10");
        console.log("rb_sku_platform page_urls: ", res);
    } catch(e) { console.error(e.message); }
}
test();
