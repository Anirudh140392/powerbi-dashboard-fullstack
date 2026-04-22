import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        let res = await queryClickHouse("SELECT image_url FROM rb_pdp_olap WHERE image_url IS NOT NULL AND image_url != '' AND image_url != 'na' AND image_url != 'NA' LIMIT 10");
        console.log("rb_pdp_olap image_urls: ", res);
    } catch(e) { console.error(e.message); }
}
test();
