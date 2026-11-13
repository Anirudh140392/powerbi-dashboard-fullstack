import { queryClickHouse } from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        console.log("--- Querying rb_ms_olap ---");
        const countRes = await queryClickHouse("SELECT count() as c FROM rb_ms_olap");
        console.log("Total rows in rb_ms_olap:", countRes);

        const samples = await queryClickHouse("SELECT * FROM rb_ms_olap LIMIT 3");
        console.log("Sample rows in rb_ms_olap:", JSON.stringify(samples, null, 2));

        const categories = await queryClickHouse("SELECT category, count() FROM rb_ms_olap GROUP BY category LIMIT 10");
        console.log("Categories:", categories);

        const platforms = await queryClickHouse("SELECT platform, count() FROM rb_ms_olap GROUP BY platform LIMIT 10");
        console.log("Platforms:", platforms);

        const dates = await queryClickHouse("SELECT min(created_on), max(created_on) FROM rb_ms_olap");
        console.log("Dates range:", dates);

    } catch (err) {
        console.error(err);
    }
}
run().then(() => process.exit(0));
