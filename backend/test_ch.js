import { queryClickHouse } from './src/config/clickhouse.js';
import { setCurrentDbName } from './src/config/RequestContext.js';

async function test() {
    try {
        const q1 = "SELECT DISTINCT platform FROM rb_pdp_olap WHERE lower(CHANNEL) = 'quickcomm'";
        const res1 = await queryClickHouse(q1);
        console.log("QComm in pdp:", res1);
        
        const q2 = "SELECT DISTINCT platform FROM rb_content_olap";
        const res2 = await queryClickHouse(q2);
        console.log("All platforms in content:", res2);
    } catch(e) {
        console.error(e);
    }
}
test();
