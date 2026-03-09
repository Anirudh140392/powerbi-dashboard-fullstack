import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const dbs = await queryClickHouse("SHOW DATABASES");
        for (const db of dbs) {
            const name = db.name;
            const tables = await queryClickHouse(`SHOW TABLES FROM ${name}`);
            if (tables.some(t => t.name === 'rb_pdp_olap')) {
                const cols = await queryClickHouse(`SELECT name FROM system.columns WHERE database = '${name}' AND table = 'rb_pdp_olap'`);
                const hasUpper = cols.some(c => c.name === 'Category');
                const hasLower = cols.some(c => c.name === 'category');
                console.log(`DB: ${name} | rb_pdp_olap: Category=${hasUpper}, category=${hasLower}`);
            }
        }
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
