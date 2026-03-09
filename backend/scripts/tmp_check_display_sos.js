const { queryClickHouse } = require('./src/utils/clickhouse.js');

async function test() {
    try {
        console.log("Checking dates in rb_kw...");
        const dates = await queryClickHouse("SELECT min(created_on) as min_date, max(created_on) as max_date FROM rb_kw");
        console.log("Dates:", dates);

        console.log("\nChecking available columns related to display or sponsored:");
        const res = await queryClickHouse("DESCRIBE TABLE rb_kw");
        res.filter(r => r.name.toLowerCase().includes('spons') || r.name.toLowerCase().includes('disp') || r.name.toLowerCase().includes('ad')).forEach(r => {
            console.log(r.name, r.type);
        });

    } catch (e) {
        console.error(e);
    }
}
test();
