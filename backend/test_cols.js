import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const r = await queryClickHouse("SELECT image_url, Product FROM mamaearth.rb_pdp_olap WHERE image_url != '' LIMIT 5");
        console.log(JSON.stringify(r, null, 2));
    } catch(e) {
        console.error(e);
    }
}
run();
