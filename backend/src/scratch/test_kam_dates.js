import { queryClickHouse } from '../config/clickhouse.js';

async function testKamDates() {
    try {
        const pdpTable = 'emami.rb_pdp';
        const kamTable = 'emami.emami_kam_master';

        const kamsRes = await queryClickHouse(`SELECT DISTINCT kam FROM ${kamTable}`);
        console.log("KAMs in master:", kamsRes.map(r => r.kam));

        for (const kRow of kamsRes) {
            const kam = kRow.kam;
            if (!kam) continue;
            const q = `
                SELECT 
                    min(p.created_on) as minC, 
                    max(p.created_on) as maxC,
                    count(*) as totalRows
                FROM ${pdpTable} AS p 
                INNER JOIN ${kamTable} AS k 
                    ON lower(trim(p.platform_name)) = lower(trim(k.platform_name)) 
                    AND lower(trim(p.location_name)) = lower(trim(k.location_name))
                WHERE lower(trim(k.kam)) = '${kam.toLowerCase()}' AND p.price_rp > 0 AND p.price_sp > 0
            `;
            const res = await queryClickHouse(q);
            console.log(`KAM '${kam}' PDP dates:`, res);
        }

    } catch (err) {
        console.error(err);
    }
}

testKamDates();
