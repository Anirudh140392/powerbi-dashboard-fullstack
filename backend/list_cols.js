import { queryClickHouse } from './src/config/clickhouse.js';

async function listCols() {
    try {
        const query = `DESCRIBE rb_pdp_olap`;
        const results = await queryClickHouse(query);
        console.log('Columns:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

listCols();
