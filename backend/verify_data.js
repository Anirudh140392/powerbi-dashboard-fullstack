import { queryClickHouse } from './src/config/clickhouse.js';

async function checkData() {
    try {
        const rows = await queryClickHouse("SELECT * FROM mars.rb_pm_olap LIMIT 5");
        console.log(rows);
    } catch (e) {
        console.error(e);
    }
}
checkData().then(() => process.exit(0));
