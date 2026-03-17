import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const pdpCount = await queryClickHouse("SELECT count(*) as count FROM rb_pdp_olap");
        console.log("rb_pdp_olap row count:", pdpCount[0]?.count);

        const msCount = await queryClickHouse("SELECT count(*) as count FROM rb_ms_olap");
        console.log("rb_ms_olap row count:", msCount[0]?.count);
        
        const pdpLocations = await queryClickHouse("SELECT DISTINCT Location FROM rb_pdp_olap LIMIT 10");
        console.log("pdp locations:", pdpLocations.map(r=>r.Location));

        const msLocations = await queryClickHouse("SELECT DISTINCT location FROM rb_ms_olap LIMIT 10");
        console.log("ms locations:", msLocations.map(r=>r.location));

    } catch (e) {
        console.error('Test Failed:', e);
    }
    process.exit(0);
}

test();
