import { queryClickHouse } from './config/clickhouse.js';
async function checkSchema() {
    try {
        const result = await queryClickHouse('DESCRIBE mars.rca_pm_olap');
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error(err);
    }
}
checkSchema();
