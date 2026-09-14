import { queryClickHouse } from './src/config/clickhouse.js';

async function listDbs() {
    try {
        console.log("--- Listing all databases ---");
        const dbs = await queryClickHouse(`SHOW DATABASES`);
        console.table(dbs);

        console.log("\n--- Checking tables in current DB ---");
        const tables = await queryClickHouse(`SHOW TABLES`);
        console.table(tables);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

listDbs();

