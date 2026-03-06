import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const dbs = await queryClickHouse("SHOW DATABASES");
        console.log("Databases:", dbs.map(d => d.name).join(', '));
        
        for (const db of dbs) {
            const name = db.name;
            const tables = await queryClickHouse(`SHOW TABLES FROM ${name}`);
            if (tables.some(t => t.name === 'rb_sku_platform')) {
                console.log(`Table rb_sku_platform exists in database: ${name}`);
                const cols = await queryClickHouse(`DESCRIBE TABLE ${name}.rb_sku_platform`);
                console.log(`Columns in ${name}.rb_sku_platform contains brand_name: ${cols.some(c => c.name === 'brand_name')}`);
            }
        }
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
