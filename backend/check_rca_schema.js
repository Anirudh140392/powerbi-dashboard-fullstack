
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSchema() {
    try {
        console.log('--- rca_sku_dim Schema ---');
        const results = await queryClickHouse(`DESCRIBE rca_sku_dim`);
        results.forEach(r => console.log(`${r.name}: ${r.type}`));
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSchema();
