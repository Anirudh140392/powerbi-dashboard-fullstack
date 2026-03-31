import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSchema() {
    try {
        const rows = await queryClickHouse("DESCRIBE mars.rb_pm_olap");
        console.log("COLUMNS:");
        rows.forEach(r => console.log(r.name));
    } catch (e) {
        console.error(e);
    }
}
checkSchema().then(() => process.exit(0));
