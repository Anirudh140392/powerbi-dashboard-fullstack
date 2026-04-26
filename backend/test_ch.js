import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const res = await queryClickHouse("SELECT database, table, name, type FROM system.columns WHERE name LIKE '%search%'");
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
         console.error(e);
    }
}
run();
