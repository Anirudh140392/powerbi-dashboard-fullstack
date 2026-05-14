import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const tables = await queryClickHouse(`SHOW TABLES`);
        console.log("All tables:", tables.map(t => Object.values(t)[0]));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
