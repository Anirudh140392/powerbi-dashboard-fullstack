import * as dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        // Check if table exists in drl database
        const tables = await queryClickHouse("SHOW TABLES FROM drl LIKE '%primary%'");
        console.log("Tables matching 'primary' in drl:", tables);

        // Describe the table
        const columns = await queryClickHouse("DESCRIBE TABLE drl.drl_primary_sales_olap");
        console.log("\nColumns of drl.drl_primary_sales_olap:");
        columns.forEach(c => console.log(`  ${c.name} (${c.type})`));

        // Sample data
        const sample = await queryClickHouse("SELECT * FROM drl.drl_primary_sales_olap LIMIT 3");
        console.log("\nSample data:");
        console.log(JSON.stringify(sample, null, 2));

        // Date range
        const dateRange = await queryClickHouse("SELECT MIN(billing_date) as min_date, MAX(billing_date) as max_date FROM drl.drl_primary_sales_olap");
        console.log("\nDate range:", dateRange);

        // Distinct values for key dimensions
        const platforms = await queryClickHouse("SELECT DISTINCT platform FROM drl.drl_primary_sales_olap LIMIT 20");
        console.log("\nPlatforms:", platforms.map(p => p.platform));

        const channels = await queryClickHouse("SELECT DISTINCT channel FROM drl.drl_primary_sales_olap LIMIT 20");
        console.log("\nChannels:", channels.map(c => c.channel));

        const divisions = await queryClickHouse("SELECT DISTINCT division FROM drl.drl_primary_sales_olap LIMIT 20");
        console.log("\nDivisions:", divisions.map(d => d.division));

        const zones = await queryClickHouse("SELECT DISTINCT zone FROM drl.drl_primary_sales_olap LIMIT 20");
        console.log("\nZones:", zones.map(z => z.zone));

        const brands = await queryClickHouse("SELECT DISTINCT brand FROM drl.drl_primary_sales_olap LIMIT 20");
        console.log("\nBrands:", brands.map(b => b.brand));

        // Quick total
        const total = await queryClickHouse("SELECT SUM(amount_inr) as total FROM drl.drl_primary_sales_olap");
        console.log("\nTotal amount_inr:", total);

        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
