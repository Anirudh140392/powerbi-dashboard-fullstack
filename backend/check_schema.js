import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSchema() {
    try {
        const res = await queryClickHouse('DESCRIBE rb_pdp_olap');
        console.log(JSON.stringify(res, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkSchema();
