import { queryClickHouse } from '../src/config/clickhouse.js';

async function run() {
    try {
        console.log("--- Listing tables in hm_stahl ---");
        // We can use the clickhouse client to run queries against hm_stahl.
        // The default client uses CLICKHOUSE_DB from env (mamaearth).
        // But the queryClickHouse helper can be run, or we can write a raw query.
        // Let's run a SHOW TABLES FROM hm_stahl query.
        const tables = await queryClickHouse(`SHOW TABLES FROM hm_stahl`);
        console.log(tables);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
