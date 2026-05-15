import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const matches = await queryClickHouse(`
            SELECT count(*) as cnt 
            FROM (SELECT DISTINCT LOWER(Platform) as p, LOWER(Web_Pid) as w, LOWER(Product) as pr FROM rb_pdp_olap) pdp
            JOIN (SELECT DISTINCT LOWER(platform_name) as p, LOWER(web_pid) as w, LOWER(mother_code) as m FROM rb_sku_platform) map
            ON pdp.p = map.p AND pdp.w = map.w
            JOIN (SELECT DISTINCT LOWER(platform) as p, LOWER(web_pid) as w FROM rb_po_olap) po
            ON map.p = po.p AND map.w = po.w
        `);
        console.log("Matches via web_pid across all 3:", matches);

        const po_web_pid_sample = await queryClickHouse(`SELECT DISTINCT web_pid FROM rb_po_olap LIMIT 5`);
        console.log("PO web_pid sample:", po_web_pid_sample);

        const pdp_web_pid_sample = await queryClickHouse(`SELECT DISTINCT Web_Pid FROM rb_pdp_olap LIMIT 5`);
        console.log("PDP Web_Pid sample:", pdp_web_pid_sample);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
