import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function test() {
    try {
        const platformMaxDatesQuery = `SELECT platform_name, formatDateTime(max(pdp_crawl_date), '%Y-%m-%d') as maxDate FROM rb_pdp_week WHERE platform_name != '' AND platform_name IS NOT NULL GROUP BY platform_name`;
        console.log("Running query...");
        const result = await queryClickHouse(platformMaxDatesQuery);
        console.log("Query Results:", result);
    } catch (err) {
        console.error("Query Error:", err);
    }
    process.exit(0);
}
test();
