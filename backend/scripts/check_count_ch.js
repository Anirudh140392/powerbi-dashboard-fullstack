/* scripts/check_count_ch.js */
import "dotenv/config";
import { queryClickHouse } from "../src/config/clickhouse.js";

async function countRows() {
    try {
        console.log("🔍 Querying ClickHouse for row count...");
        const result = await queryClickHouse("SELECT count() as count FROM rb_pdp_olap");
        console.log("✅ Total Rows in rb_pdp_olap:", result[0].count);
        process.exit(0);
    } catch (error) {
        console.error("❌ Failed to query ClickHouse:", error);
        process.exit(1);
    }
}

countRows();
