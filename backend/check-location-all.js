import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const dbs = await queryClickHouse("SHOW DATABASES");
        for (const db of dbs) {
            const name = db.name;
            const tables = await queryClickHouse(`SHOW TABLES FROM ${name}`);
            if (tables.some(t => t.name === 'rb_location_darkstore')) {
                const cols = await queryClickHouse(`SELECT name FROM system.columns WHERE database = '${name}' AND table = 'rb_location_darkstore'`);
                console.log(`DB: ${name} | rb_location_darkstore columns: ${cols.map(c => c.name).join(', ')}`);
            }
        }
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
