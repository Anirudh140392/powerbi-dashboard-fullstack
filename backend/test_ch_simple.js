import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';

async function testQuery() {
    try {
        console.log('Testing ClickHouse query...');
        const results = await queryClickHouse('SELECT DISTINCT Category FROM rb_pdp_olap LIMIT 5');
        console.log('Results:', results);
    } catch (err) {
        console.error('Query failed:', err);
    }
}

testQuery();
