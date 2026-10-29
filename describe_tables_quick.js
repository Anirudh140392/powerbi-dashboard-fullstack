import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { queryClickHouse } from './backend/src/config/clickhouse.js';

async function describeTable(tableName) {
    try {
        console.log(`Describing table: ${tableName}`);
        const result = await queryClickHouse(`DESCRIBE ${tableName}`);
        console.table(result);
    } catch (err) {
        console.error(`Failed to describe table ${tableName}:`, err.message);
    }
}

async function run() {
    await describeTable('rb_pdp_olap');
}

run();
