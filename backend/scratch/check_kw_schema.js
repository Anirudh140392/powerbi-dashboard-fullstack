import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { setCurrentDbName, queryClickHouse } from '../src/config/clickhouse.js';

async function run() {
    setCurrentDbName('mamaearth');
    const q = `DESCRIBE TABLE rb_kw_olap`;
    const res = await queryClickHouse(q);
    console.log("rb_kw_olap columns:");
    res.forEach(r => console.log(`- ${r.name}: ${r.type}`));
    process.exit(0);
}
run();
