import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

async function check() {
    const res = await queryClickHouse("SHOW TABLES FROM drl");
    console.log(res);
}
check();
