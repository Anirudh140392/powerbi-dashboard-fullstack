import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const result = await queryClickHouse(`
            SELECT count(*) as matches
            FROM (SELECT DISTINCT LOWER(platform) as p, LOWER(sku_name) as sku FROM rb_po_olap) po
            JOIN (SELECT DISTINCT LOWER(Platform) as p, LOWER(Product) as pr FROM rb_pdp_olap) pdp
            ON po.p = pdp.p AND position(po.sku, pdp.pr) > 0
        `);
        console.log("Fuzzy matches:", result);

        const result2 = await queryClickHouse(`
            SELECT po.p, po.sku, pdp.pr
            FROM (SELECT DISTINCT LOWER(platform) as p, LOWER(sku_name) as sku FROM rb_po_olap LIMIT 100) po
            JOIN (SELECT DISTINCT LOWER(Platform) as p, LOWER(Product) as pr FROM rb_pdp_olap LIMIT 1000) pdp
            ON po.p = pdp.p AND (position(po.sku, pdp.pr) > 0 OR position(pdp.pr, po.sku) > 0)
            LIMIT 5
        `);
        console.log("Fuzzy sample:", result2);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
