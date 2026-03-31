
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSchema() {
    try {
        console.log('--- Checking rb_pdp_olap Schema ---');
        const results = await queryClickHouse(`
            DESCRIBE rb_pdp_olap
        `);
        console.log('Schema:', JSON.stringify(results, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

checkSchema();
