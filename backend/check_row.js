import { queryClickHouse } from './src/config/clickhouse.js';

async function checkRow() {
    try {
        const query = `SELECT * FROM rb_pdp_olap LIMIT 1`;
        const results = await queryClickHouse(query);
        console.log('Sample Row:', JSON.stringify(results[0], null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

checkRow();
