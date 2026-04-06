import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { queryClickHouse } from './backend/src/config/clickhouse.js';

async function checkSchema() {
    try {
        const columns = await queryClickHouse('DESCRIBE TABLE rb_kw_olap');
        console.log('--- rb_kw_olap columns ---');
        columns.forEach(c => console.log(`${c.name}: ${c.type}`));

        const sample = await queryClickHouse('SELECT * FROM rb_kw_olap LIMIT 1');
        console.log('--- rb_kw_olap sample ---');
        console.log(JSON.stringify(sample, null, 2));
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
