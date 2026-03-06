import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        console.log("Checking available columns related to display or sponsored:");
        const res = await queryClickHouse("DESCRIBE TABLE rb_kw");
        res.filter(r => r.name.toLowerCase().includes('spons') || r.name.toLowerCase().includes('disp') || r.name.toLowerCase().includes('ad')).forEach(r => {
            console.log(r.name, r.type);
        });

    } catch (e) {
        console.error(e);
    }
}
test();
