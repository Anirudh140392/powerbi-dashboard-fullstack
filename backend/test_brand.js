import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        const res = await queryClickHouse(`SELECT DISTINCT brand FROM rb_pm_olap where Platform='Instamart' AND DATE='2026-03-18'`);
        console.log("Brands in pm_olap for Instamart:", res.map(r=>r.brand));
        
        const res2 = await queryClickHouse(`SELECT DISTINCT brand_name FROM rca_sku_dim WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL`);
        console.log("Valid brand names from rca_sku_dim:", res2.map(r=>r.brand_name));
    } catch (e) {
        console.error(e);
    }
}
test();
