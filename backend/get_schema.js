import db from './src/config/clickhouse.js';
async function run() {
    try {
        const res = await db.queryClickHouse('DESCRIBE TABLE rb_sku_platform');
        console.log(JSON.stringify(res, null, 2));
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
