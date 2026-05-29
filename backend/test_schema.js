import { queryClickHouse } from './src/utils/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const res = await queryClickHouse("DESCRIBE TABLE rb_pm_olap");
    console.log(res.map(r => r.name).join(', '));
}
check().catch(console.error).finally(() => process.exit(0));
