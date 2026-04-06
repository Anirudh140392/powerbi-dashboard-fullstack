import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const dbs = await queryClickHouse('SHOW DATABASES');
        console.log("Databases:", JSON.stringify(dbs, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
