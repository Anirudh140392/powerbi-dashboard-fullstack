import { queryClickHouse, getCurrentDbName } from './src/config/clickhouse.js';
import { setCurrentDbName } from './src/utils/requestContext.js';

async function test() {
    try {
        setCurrentDbName('danone'); // Using danone since it appeared in logs
        const q1 = "SELECT DISTINCT platform as Platform FROM rb_content_olap";
        const res1 = await queryClickHouse(q1);
        console.log("rb_content_olap platforms:", res1);
        
        const q2 = "SELECT DISTINCT platform as Platform, channel as Channel FROM rb_pdp_olap";
        const res2 = await queryClickHouse(q2);
        console.log("rb_pdp_olap platforms:", res2);
    } catch(e) {
        console.error(e);
    }
}
test();
