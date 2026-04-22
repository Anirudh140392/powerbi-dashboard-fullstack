import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        let res = await queryClickHouse("SELECT image_url, URL FROM rb_pdp_olap WHERE image_url IS NOT NULL AND image_url != '' LIMIT 5");
        console.log("rb_pdp_olap image_urls: ", res);
    } catch(e) { console.error(e.message); }
}
test();
