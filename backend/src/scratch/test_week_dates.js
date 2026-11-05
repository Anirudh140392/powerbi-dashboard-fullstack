import { queryClickHouse, dbStorage } from '../config/clickhouse.js';

async function testWeekTable() {
    await dbStorage.run('boat', async () => {
        try {
            console.log("Checking boat.rb_pdp_week...");
            const res = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC, min(pdp_crawl_date) as minP, max(pdp_crawl_date) as maxP FROM rb_pdp_week`);
            console.log("boat.rb_pdp_week:", res);
        } catch (e) {
            console.log("error:", e.message);
        }
    });

    await dbStorage.run('emami', async () => {
        try {
            console.log("Checking emami.rb_pdp_week...");
            const res = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC, min(pdp_crawl_date) as minP, max(pdp_crawl_date) as maxP FROM emami.rb_pdp_week`);
            console.log("emami.rb_pdp_week:", res);
        } catch (e) {
            console.log("error:", e.message);
        }
    });
}

testWeekTable();
