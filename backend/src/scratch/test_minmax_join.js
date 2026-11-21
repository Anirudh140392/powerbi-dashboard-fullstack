import { queryClickHouse } from '../config/clickhouse.js';

async function testMinMax() {
    try {
        const pdpTable = 'emami.rb_pdp';
        const kamTable = 'emami.emami_kam_master';
        const dateCol = 'created_on';

        const minMaxQuery = `
            SELECT 
                formatDateTime(min(p.${dateCol}), '%Y-%m-%d') AS minDate, 
                formatDateTime(max(p.${dateCol}), '%Y-%m-%d') AS maxDate 
            FROM ${pdpTable} AS p 
            INNER JOIN ${kamTable} AS k 
                ON lower(trim(p.platform_name)) = lower(trim(k.platform_name)) 
                AND lower(trim(p.location_name)) = lower(trim(k.location_name))
            WHERE p.price_rp > 0 AND p.price_sp > 0
        `;

        const res = await queryClickHouse(minMaxQuery);
        console.log("minMaxQuery result:", res);

        const sampleDates = await queryClickHouse(`
            SELECT 
                toDate(p.created_on) as dt,
                count(*) as cnt
            FROM ${pdpTable} AS p 
            INNER JOIN ${kamTable} AS k 
                ON lower(trim(p.platform_name)) = lower(trim(k.platform_name)) 
                AND lower(trim(p.location_name)) = lower(trim(k.location_name))
            WHERE p.price_rp > 0 AND p.price_sp > 0
            GROUP BY dt
            ORDER BY dt ASC
            LIMIT 20
        `);
        console.log("Earliest 20 dates when joined with KAM master:", sampleDates);

    } catch (err) {
        console.error(err);
    }
}

testMinMax();
