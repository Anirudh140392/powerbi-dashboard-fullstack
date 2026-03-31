import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSchema() {
    try {
        const results = await queryClickHouse('DESCRIBE rb_pm_olap');
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
