import clickhouse from './src/utils/clickhouse.js';

async function checkSchema() {
    try {
        const rows = await clickhouse.queryClickHouse("DESCRIBE mars.rca_pm_olap");
        console.log("COLUMNS:");
        rows.forEach(r => console.log(r.name));
    } catch (e) {
        console.error(e);
    }
}
checkSchema();
