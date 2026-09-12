import { queryClickHouse } from './src/config/clickhouse.js';

async function listColumns() {
    try {
        const columns = await queryClickHouse('DESCRIBE TABLE rb_kw_olap');
        console.log('--- rb_kw_olap columns ---');
        for (const col of columns) {
            console.log(`${col.name}: ${col.type}`);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

listColumns();
