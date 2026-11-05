import { ClickHouse } from 'clickhouse';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = new ClickHouse({
    url: process.env.CLICKHOUSE_URL || 'http://localhost',
    port: process.env.CLICKHOUSE_PORT || 8123,
    debug: false,
    basicAuth: null,
    isUseGzip: true,
    format: "json",
    config: {
        database: 'danone', // FORCE danone!
    }
});

async function test() {
    try {
        const res = await clickhouse.query("SELECT DISTINCT brand_name_th, brand, sub_brand FROM rb_kw_olap LIMIT 1").toPromise();
        console.log("Success");
    } catch(e) {
        console.error("Error:", e.message);
    }
}
test();
