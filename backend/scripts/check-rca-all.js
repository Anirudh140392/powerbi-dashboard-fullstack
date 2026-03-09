import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const dbs = await queryClickHouse("SHOW DATABASES");
        for (const db of dbs) {
            const name = db.name;
            const tables = await queryClickHouse(`SHOW TABLES FROM ${name}`);
            if (tables.some(t => t.name === 'rca_sku_dim')) {
                console.log(`Table rca_sku_dim exists in database: ${name}`);
                const cols = await queryClickHouse(`DESCRIBE TABLE ${name}.rca_sku_dim`);
                console.log(`Columns in ${name}.rca_sku_dim: ${cols.map(c => c.name).join(', ')}`);
            }
        }
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
