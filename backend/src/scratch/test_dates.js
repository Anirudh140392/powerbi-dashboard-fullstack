import { queryClickHouse } from '../config/clickhouse.js';

const checkTableExists = async (tableName) => {
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        const exists = result?.[0]?.result === 1 || result?.[0]?.result === '1' || result?.[0]?.['result'] === 1;
        return exists;
    } catch {
        return false;
    }
};

async function testDates() {
    try {
        console.log("=== Testing database PDP dates ===");
        const pdpTable = (await checkTableExists('rb_pdp')) ? 'rb_pdp' : (await checkTableExists('emami.rb_pdp')) ? 'emami.rb_pdp' : 'rb_pdp';
        console.log("pdpTable resolved to:", pdpTable);

        const minMaxCreatedOn = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC, min(pdp_crawl_date) as minP, max(pdp_crawl_date) as maxP FROM ${pdpTable}`);
        console.log("rb_pdp min/max:", minMaxCreatedOn);

        const minMaxWithWhere = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC FROM ${pdpTable} WHERE platform_name IN ('dmart', 'metro', 'reliance retail', 'walmart')`);
        console.log("rb_pdp with platform filter min/max:", minMaxWithWhere);

        const minMaxWithRP = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC FROM ${pdpTable} WHERE price_rp > 0 AND price_sp > 0`);
        console.log("rb_pdp with price > 0 min/max:", minMaxWithRP);

        const sampleAugust = await queryClickHouse(`SELECT count(*) as countAug, min(created_on) as minAug, max(created_on) as maxAug FROM ${pdpTable} WHERE created_on >= '2026-08-01' AND created_on <= '2026-08-31'`);
        console.log("August count:", sampleAugust);

        const platformMinMax = await queryClickHouse(`SELECT platform_name, min(created_on) as minC, max(created_on) as maxC FROM ${pdpTable} GROUP BY platform_name`);
        console.log("Platform min/max:", platformMinMax);

    } catch (err) {
        console.error("Error running test:", err);
    }
}

testDates();
