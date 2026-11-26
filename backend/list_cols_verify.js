import { queryClickHouse } from './src/config/clickhouse.js';

async function listCols() {
    try {
        const query = `DESCRIBE rb_product_verify`;
        const results = await queryClickHouse(query);
        console.log('Columns of rb_product_verify:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

listCols();
