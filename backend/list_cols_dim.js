import { queryClickHouse } from './src/config/clickhouse.js';

async function listCols() {
    try {
        const query = `DESCRIBE rca_sku_dim`;
        const results = await queryClickHouse(query);
        console.log('Columns of rca_sku_dim:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

listCols();
