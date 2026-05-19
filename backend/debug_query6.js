import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const pdp = await queryClickHouse(`SELECT DISTINCT Web_Pid, Product FROM rb_pdp_olap WHERE Product LIKE '%galaxy%' LIMIT 5`);
        console.log("PDP Web_Pid:", pdp);
        
        const po = await queryClickHouse(`SELECT DISTINCT web_pid, sku_name FROM rb_po_olap WHERE sku_name LIKE '%galaxy%' LIMIT 5`);
        console.log("PO Web_Pid:", po);
        
        const matches = await queryClickHouse(`
            SELECT count(*) as cnt 
            FROM (SELECT DISTINCT LOWER(Platform) as p, LOWER(Web_Pid) as w FROM rb_pdp_olap) pdp
            JOIN (SELECT DISTINCT LOWER(platform) as p, LOWER(web_pid) as w FROM rb_po_olap) po
            ON pdp.p = po.p AND pdp.w = po.w
        `);
        console.log("Total Web_Pid matches:", matches);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
