import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        console.log("--- Location Tier Counts ---");
        const tiers = await queryClickHouse("SELECT tier, count() FROM rb_location_darkstore GROUP BY tier");
        console.table(tiers);

        console.log("--- Blinkit OSA Breakdown ---");
        const results = await queryClickHouse(`
            WITH 
                (SELECT groupArray(location) FROM rb_location_darkstore WHERE tier = 'Tier 1') as t1,
                (SELECT groupArray(location) FROM rb_location_darkstore WHERE tier = 'Tier 2') as t2
            SELECT 
                'Overall' as type,
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0) * 100 as osa,
                SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as total_deno
            FROM rb_pdp_olap
            WHERE Platform ILIKE 'blinkit'
            UNION ALL
            SELECT 
                'Tier 1 (Metro)' as type,
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0) * 100 as osa,
                SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as total_deno
            FROM rb_pdp_olap
            WHERE Platform ILIKE 'blinkit' AND Location IN (SELECT location FROM rb_location_darkstore WHERE tier = 'Tier 1')
            UNION ALL
            SELECT 
                'Tier 2' as type,
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0) * 100 as osa,
                SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as total_deno
            FROM rb_pdp_olap
            WHERE Platform ILIKE 'blinkit' AND Location IN (SELECT location FROM rb_location_darkstore WHERE tier = 'Tier 2')
        `);
        console.table(results);

        console.log("--- Tier 1 Locations with Low OSA (Blinkit) ---");
        const lowOsa = await queryClickHouse(`
            SELECT 
                Location,
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0) * 100 as osa,
                SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as total_deno
            FROM rb_pdp_olap
            WHERE Platform ILIKE 'blinkit' AND Location IN (SELECT location FROM rb_location_darkstore WHERE tier = 'Tier 1')
            GROUP BY Location
            ORDER BY osa ASC
            LIMIT 10
        `);
        console.table(lowOsa);

    } catch (e) {
        console.error(e);
    }
}

run();
