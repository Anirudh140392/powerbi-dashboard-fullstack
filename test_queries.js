import { queryClickHouse } from './backend/src/config/clickhouse.js';
async function run() {
    const sDate = '2024-03-01'; // Try a date range
    const eDate = '2024-03-31';
    
    // Total count for Boat
    const brandQ = `SELECT brand, SUM(impressions) as imp, SUM(organic_impressions) as org FROM \`quick-comm\`.rb_platform_offtake WHERE toDate(Date) BETWEEN '${sDate}' AND '${eDate}' AND brand='Boat' AND comp_flag='0' GROUP BY brand`;
    console.log("BRAND QUERY BOAT", await queryClickHouse(brandQ));
    
    const olapQ = `SELECT SUM(impressions) as imp, SUM(organic_impressions) as org FROM \`quick-comm\`.rb_platform_offtake WHERE toDate(Date) BETWEEN '${sDate}' AND '${eDate}' AND comp_flag='0'`;
    console.log("OLAP QUERY TOTAL", await queryClickHouse(olapQ));
}
run().catch(console.error).finally(() => process.exit(0));
