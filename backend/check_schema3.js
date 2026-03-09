const { queryClickHouse } = require('./src/utils/clickHouse');

async function checkSchema() {
    try {
        const rows = await queryClickHouse("DESCRIBE mars.rca_pm_olap");
        console.log("COLUMNS:");
        rows.forEach(r => console.log(r.name));
    } catch (e) {
        console.error(e);
    }
}
checkSchema();
