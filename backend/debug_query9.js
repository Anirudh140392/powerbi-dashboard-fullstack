import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const matches = await queryClickHouse(`
            SELECT count(*) as cnt 
            FROM (SELECT DISTINCT LOWER(Platform) as p, LOWER(Web_Pid) as w FROM rb_pdp_olap) pdp
            JOIN (SELECT DISTINCT LOWER(platform) as p, LOWER(item_id) as w FROM rb_po_olap) po
            ON pdp.p = po.p AND pdp.w = po.w
        `);
        console.log("Matches via item_id = Web_Pid:", matches);

        const po_sample = await queryClickHouse(`SELECT platform, sku_name, web_pid, item_id FROM rb_po_olap LIMIT 5`);
        console.log("PO sample:", po_sample);

        const pdp_sample = await queryClickHouse(`SELECT Platform, Product, Web_Pid FROM rb_pdp_olap LIMIT 5`);
        console.log("PDP sample:", pdp_sample);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
