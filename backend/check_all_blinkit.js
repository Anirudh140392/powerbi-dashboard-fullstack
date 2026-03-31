
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkAllBlinkit() {
    try {
        console.log('--- Checking ALL unique Categories for Blinkit ---');
        const results = await queryClickHouse(`
            SELECT DISTINCT Category
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
        `);
        console.log('Results:', JSON.stringify(results, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

checkAllBlinkit();
