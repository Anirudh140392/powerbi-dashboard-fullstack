
import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';

async function check() {
    try {
        console.log('Using CLICKHOUSE_USER:', process.env.CLICKHOUSE_USER);
        const result = await queryClickHouse('DESCRIBE TABLE test_brand_MS');
        console.log('Columns of test_brand_MS:', JSON.stringify(result, null, 2));

        const sample = await queryClickHouse('SELECT * FROM test_brand_MS LIMIT 1');
        console.log('Sample row from test_brand_MS:', JSON.stringify(sample, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

check();
