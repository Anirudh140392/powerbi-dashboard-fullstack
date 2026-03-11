process.env.CLICKHOUSE_URL='http://13.200.55.131:8123';
process.env.CLICKHOUSE_USER='readonly_user';
process.env.CLICKHOUSE_PASSWORD='Readonly@123';
process.env.CLICKHOUSE_DB='mars';

const { queryClickHouse } = require('./backend/src/config/clickhouse.js');

async function test() {
    try {
        const r = await queryClickHouse("DESCRIBE rb_pdp_olap");
        console.log(r.map(c => c.name).join(','));
    } catch (e) {
        console.error(e);
    }
}
test();
