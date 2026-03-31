process.env.CLICKHOUSE_URL='http://13.200.55.131:8123';
process.env.CLICKHOUSE_USER='readonly_user';
process.env.CLICKHOUSE_PASSWORD='Readonly@123';
process.env.CLICKHOUSE_DB='mars';

const { queryClickHouse } = require('./backend/src/config/clickhouse.js');

async function test() {
    try {
        const r = await queryClickHouse("SELECT Web_Pid, Product, Brand FROM rb_pdp_olap WHERE Product LIKE '%Boomer Tube%' LIMIT 5");
        console.log(JSON.stringify(r, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
