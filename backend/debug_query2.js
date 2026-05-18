import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const pdp = await queryClickHouse(`SELECT DISTINCT LOWER(Product) as sku FROM rb_pdp_olap LIMIT 10`);
        console.log("PDP SKUs:", pdp);
        
        const po = await queryClickHouse(`SELECT DISTINCT LOWER(sku_name) as sku FROM rb_po_olap LIMIT 10`);
        console.log("PO SKUs:", po);

        const pdpPlatforms = await queryClickHouse(`SELECT DISTINCT Platform FROM rb_pdp_olap LIMIT 10`);
        console.log("PDP Platforms:", pdpPlatforms);

        const poPlatforms = await queryClickHouse(`SELECT DISTINCT platform FROM rb_po_olap LIMIT 10`);
        console.log("PO Platforms:", poPlatforms);
        
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
