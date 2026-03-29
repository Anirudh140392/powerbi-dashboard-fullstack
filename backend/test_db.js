import { queryClickHouse } from './src/config/clickhouse.js';
async function run() {
    try {
        const res = await queryClickHouse("DESCRIBE TABLE rb_kw_olap");
        console.log("COLUMNS:");
        res.forEach(r => console.log(r.name || r.Name));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
