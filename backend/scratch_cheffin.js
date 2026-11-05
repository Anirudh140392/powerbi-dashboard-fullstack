import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';

async function main() {
    try {
        console.log("--- 1. Querying Row Counts ---");
        const countRes = await queryClickHouse("SELECT count() as total_rows FROM cheffin.rb_kw_olap");
        console.log("Total rows:", countRes[0]?.total_rows);

        console.log("\n--- 2. Date Range ---");
        const dateRange = await queryClickHouse("SELECT min(DATE) as min_date, max(DATE) as max_date FROM cheffin.rb_kw_olap");
        console.log("Date range:", dateRange[0]);

        console.log("\n--- 3. Brand / Flag Distribution (Top 20) ---");
        const dist = await queryClickHouse("SELECT brand, flag, count() as cnt FROM cheffin.rb_kw_olap GROUP BY brand, flag ORDER BY cnt DESC LIMIT 20");
        console.table(dist);

        console.log("\n--- 4. checking records with flag = 1 ---");
        const flags = await queryClickHouse("SELECT flag, count() as cnt FROM cheffin.rb_kw_olap GROUP BY flag");
        console.table(flags);

        console.log("\n--- 5. Sample Rows with flag = 1 (if any) ---");
        const samples = await queryClickHouse("SELECT keyword, brand, flag, overall, organic, spons, DATE FROM cheffin.rb_kw_olap WHERE flag = 1 LIMIT 5");
        console.table(samples);

        console.log("\n--- 6. Sample Rows with flag = '1' (as string, if any) ---");
        const samplesStr = await queryClickHouse("SELECT keyword, brand, flag, overall, organic, spons, DATE FROM cheffin.rb_kw_olap WHERE flag = '1' LIMIT 5");
        console.table(samplesStr);

    } catch (e) {
        console.error("Error executing queries:", e);
    }
    process.exit(0);
}

main();
