import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const tables = await queryClickHouse(`SHOW TABLES LIKE '%prioriti%'`);
        console.log("Matching tables:", tables);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
