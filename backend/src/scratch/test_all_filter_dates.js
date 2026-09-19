import { queryClickHouse, dbStorage } from '../config/clickhouse.js';

async function testAllFiltersMinMax() {
    await dbStorage.run('emami', async () => {
        const pdpTable = 'emami.rb_pdp';
        const kamTable = 'emami.emami_kam_master';

        console.log("=== Checking min/max date by Platform in Promo Violation ===");
        const platforms = await queryClickHouse(`SELECT DISTINCT platform_name FROM ${pdpTable}`);
        for (const pRow of platforms) {
            const plat = pRow.platform_name;
            if (!plat) continue;
            const q = `
                SELECT 
                    formatDateTime(min(p.created_on), '%Y-%m-%d') as minD, 
                    formatDateTime(max(p.created_on), '%Y-%m-%d') as maxD,
                    count(*) as cnt
                FROM ${pdpTable} AS p
                INNER JOIN ${kamTable} AS k
                    ON lower(trim(p.platform_name)) = lower(trim(k.platform_name))
                    AND lower(trim(p.location_name)) = lower(trim(k.location_name))
                WHERE lower(trim(p.platform_name)) = '${plat.toLowerCase()}' AND p.price_rp > 0 AND p.price_sp > 0
            `;
            const res = await queryClickHouse(q);
            console.log(`Platform '${plat}':`, res[0]);
        }

        console.log("\n=== Checking min/max date by KAM in Promo Violation ===");
        const kams = await queryClickHouse(`SELECT DISTINCT kam FROM ${kamTable}`);
        for (const kRow of kams) {
            const kam = kRow.kam;
            if (!kam) continue;
            const q = `
                SELECT 
                    formatDateTime(min(p.created_on), '%Y-%m-%d') as minD, 
                    formatDateTime(max(p.created_on), '%Y-%m-%d') as maxD,
                    count(*) as cnt
                FROM ${pdpTable} AS p
                INNER JOIN ${kamTable} AS k
                    ON lower(trim(p.platform_name)) = lower(trim(k.platform_name))
                    AND lower(trim(p.location_name)) = lower(trim(k.location_name))
                WHERE lower(trim(k.kam)) = '${kam.toLowerCase()}' AND p.price_rp > 0 AND p.price_sp > 0
            `;
            const res = await queryClickHouse(q);
            console.log(`KAM '${kam}':`, res[0]);
        }
    });
}

testAllFiltersMinMax();
