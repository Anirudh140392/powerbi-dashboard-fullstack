const { queryClickHouse } = require('./src/config/clickhouse.js');

async function check() {
    try {
        const schema = await queryClickHouse('DESCRIBE rb_kw_olap');
        console.log('Schema:', schema.filter(r => r.name.toLowerCase().includes('flag') || r.name.toLowerCase().includes('comp')));
        const sample = await queryClickHouse('SELECT flag, count(*) as c FROM rb_kw_olap GROUP BY flag');
        console.log('Flag counts:', sample);
    } catch (err) {
        console.error(err);
    }
}
check();
