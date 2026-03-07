import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        console.log("Checking all Product_Category values in rb_pdp_olap...");
        const query = `SELECT DISTINCT Product_Category as cat FROM rb_pdp_olap ORDER BY cat`;
        const results = await queryClickHouse(query);
        console.log("rb_pdp_olap Categories:", results.map(r => r.cat));

        console.log("\nChecking all Category values in rca_sku_dim...");
        const queryDim = `SELECT DISTINCT category FROM rca_sku_dim ORDER BY category`;
        const resultsDim = await queryClickHouse(queryDim);
        console.log("rca_sku_dim Categories:", resultsDim.map(r => r.category));

        console.log("\nChecking recent records (2026) in rb_pdp_olap for Product_Category...");
        const queryRecent = `SELECT DISTINCT Product_Category as cat FROM rb_pdp_olap WHERE toDate(DATE) >= '2026-01-01' ORDER BY cat`;
        const resultsRecent = await queryClickHouse(queryRecent);
        console.log("2026 rb_pdp_olap Categories:", resultsRecent.map(r => r.cat));

    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
