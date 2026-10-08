import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const query1 = `
            SELECT DISTINCT Location FROM rb_pdp_olap 
            WHERE Location IN (SELECT location FROM rb_location_darkstore WHERE tier IN ('Tier 1', 'Tier 2'))
        `;
        const res1 = await queryClickHouse(query1);
        console.log("Matching locations with case-sensitive IN:", res1);

        const query2 = `
            SELECT DISTINCT Location FROM rb_pdp_olap 
            WHERE LOWER(Location) IN (SELECT DISTINCT LOWER(location) FROM rb_location_darkstore WHERE tier IN ('Tier 1', 'Tier 2'))
        `;
        const res2 = await queryClickHouse(query2);
        console.log("Matching locations with LOWER():", res2.map(r => r.Location));

    } catch (e) {
        console.error(e);
    }
}
run();
