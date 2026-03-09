import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    try {
        const tables = ['rca_sku_dim', 'rb_pdp_olap', 'rb_sku_platform', 'rb_brand_ms', 'rb_kw', 'rb_location_darkstore'];
        for (const table of tables) {
            console.log(`\n--- ${table} ---`);
            const res = await queryClickHouse(`DESCRIBE TABLE ${table}`);
            const columns = res.map(r => r.name);
            console.log("Columns:", columns.join(', '));
            
            // Check count of non-null values for category-related columns
            if (table === 'rca_sku_dim') {
                const checkCols = columns.filter(c => c.toLowerCase().includes('category'));
                for (const col of checkCols) {
                    const countRes = await queryClickHouse(`SELECT count() as cnt FROM rca_sku_dim WHERE ${col} IS NOT NULL AND ${col} != ''`);
                    console.log(`Column ${col} has ${countRes[0].cnt} non-empty rows`);
                }
                
                const checkBrandCols = columns.filter(c => c.toLowerCase().includes('brand'));
                for (const col of checkBrandCols) {
                    const countRes = await queryClickHouse(`SELECT count() as cnt FROM rca_sku_dim WHERE ${col} IS NOT NULL AND ${col} != ''`);
                    console.log(`Column ${col} has ${countRes[0].cnt} non-empty rows`);
                }
            }
            if (table === 'rb_pdp_olap') {
                const checkCols = columns.filter(c => c.toLowerCase().includes('category'));
                for (const col of checkCols) {
                    const countRes = await queryClickHouse(`SELECT count() as cnt FROM rb_pdp_olap WHERE ${col} IS NOT NULL AND ${col} != ''`);
                    console.log(`Column ${col} has ${countRes[0].cnt} non-empty rows`);
                }
            }
        }
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
