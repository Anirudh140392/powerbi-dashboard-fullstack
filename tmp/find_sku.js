
import { queryClickHouse } from '../backend/src/config/clickhouse.js';

async function run() {
    try {
        process.env.CLICKHOUSE_URL = 'http://13.200.55.131:8123';
        process.env.CLICKHOUSE_USER = 'readonly_user';
        process.env.CLICKHOUSE_PASSWORD = 'Readonly@123';
        process.env.CLICKHOUSE_DB = 'mars';

        const q = "SELECT DISTINCT Web_Pid, Product, Item_Id FROM rb_pdp_olap WHERE Product LIKE '%Mixed Minis%' LIMIT 10";
        const res = await queryClickHouse(q);
        console.log(JSON.stringify(res, null, 2));
    } catch (err) {
        console.error(err);
    }
}
run();
