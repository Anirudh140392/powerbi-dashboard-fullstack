import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function checkTables() {
    try {
        const { queryClickHouse } = await import('./src/config/clickhouse.js');
        const tables = await queryClickHouse("SHOW TABLES LIKE '%ms'");
        console.log("MS Tables:", tables);

        const skuTables = await queryClickHouse("SHOW TABLES LIKE '%sku%'");
        console.log("SKU Tables:", skuTables);

        // check rb_brand_ms columns
        const columns = await queryClickHouse("DESCRIBE TABLE rb_brand_ms");
        const containsSku = columns.some(c => c.name.toLowerCase().includes('sku'));
        console.log("rb_brand_ms contains sku?", containsSku);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkTables();
