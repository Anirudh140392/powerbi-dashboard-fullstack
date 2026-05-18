import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const matches = await queryClickHouse(`
            SELECT count(*) as cnt 
            FROM (SELECT DISTINCT LOWER(Platform) as p, LOWER(Product) as m FROM rb_pdp_olap) pdp
            JOIN (
                SELECT DISTINCT LOWER(platform_name) as p, LOWER(mother_code) as m, LOWER(sku_name) as sku
                FROM rb_sku_platform
            ) map ON pdp.p = map.p AND pdp.m = map.m
            JOIN (SELECT DISTINCT LOWER(platform) as p, LOWER(sku_name) as sku FROM rb_po_olap) po
            ON map.p = po.p AND map.sku = po.sku
        `);
        console.log("Matches via rb_sku_platform (sku_name):", matches);
        
        const matches2 = await queryClickHouse(`
            SELECT count(*) as cnt 
            FROM (SELECT DISTINCT LOWER(Platform) as p, LOWER(Product) as m FROM rb_pdp_olap) pdp
            JOIN (
                SELECT DISTINCT LOWER(platform_name) as p, LOWER(mother_code) as m, toString(sku_id) as sid
                FROM rb_sku_platform
            ) map ON pdp.p = map.p AND pdp.m = map.m
            JOIN (SELECT DISTINCT LOWER(platform) as p, item_id FROM rb_po_olap) po
            ON map.p = po.p AND map.sid = po.item_id
        `);
        console.log("Matches via rb_sku_platform (item_id):", matches2);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
