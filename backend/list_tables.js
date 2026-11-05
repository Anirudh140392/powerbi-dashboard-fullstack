import { queryClickHouse } from './src/config/clickhouse.js';

async function listTables() {
    try {
        const query = `SHOW TABLES`;
        const results = await queryClickHouse(query);
        console.log('Tables:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

listTables();
