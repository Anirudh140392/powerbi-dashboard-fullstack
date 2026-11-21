import { queryClickHouse } from '../config/clickhouse.js';

async function testAllPdpTables() {
    try {
        console.log("Checking emami tables...");
        const tables = ['emami.rb_pdp', 'emami.rb_pdp_week', 'emami.rb_pdp_olap'];
        for (const t of tables) {
            try {
                const res = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC, min(pdp_crawl_date) as minP, max(pdp_crawl_date) as maxP FROM ${t}`);
                console.log(`Table ${t}:`, res);
            } catch (e) {
                console.log(`Table ${t} error:`, e.message);
            }
        }
    } catch (err) {
        console.error(err);
    }
}

testAllPdpTables();
