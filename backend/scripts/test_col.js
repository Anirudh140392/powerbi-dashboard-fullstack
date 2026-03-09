import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { queryClickHouse } from '../src/config/clickhouse.js';
async function run() {
    const schema2 = await queryClickHouse('DESCRIBE rb_pdp_olap');
    const cols = schema2.map(c => c.name);
    console.log(cols.includes('Product_Category') ? 'YES Product_Category exists' : 'NO Product_Category does not exist');
    console.log(cols);
    process.exit(0);
}
run();
