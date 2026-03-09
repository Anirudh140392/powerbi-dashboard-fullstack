import { queryClickHouse } from './src/config/clickhouse.js';

async function debugFormat() {
    try {
        console.log("--- Checking rca_sku_dim ---");
        const skuDim = await queryClickHouse(`SELECT category, status, count() as count FROM rca_sku_dim GROUP BY category, status LIMIT 20`);
        console.table(skuDim);

        console.log("\n--- Checking rb_pdp_olap Category column ---");
        const pdpOlap = await queryClickHouse(`SELECT Category, count() as count FROM rb_pdp_olap GROUP BY Category LIMIT 20`);
        console.table(pdpOlap);

        console.log("\n--- Checking distinct Categories with status=1 logic ---");
        const validCatResult = await queryClickHouse(`SELECT DISTINCT category FROM rca_sku_dim WHERE status = 1 AND category IS NOT NULL AND category != ''`);
        const validCategories = validCatResult.map(r => r.category).filter(Boolean);
        console.log("Valid Categories:", validCategories);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

debugFormat();
