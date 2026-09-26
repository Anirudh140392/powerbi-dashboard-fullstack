import { queryClickHouse } from '../backend/src/config/clickhouse.js';

async function main() {
    try {
        const platforms = await queryClickHouse("SELECT DISTINCT Platform FROM rb_pdp_olap LIMIT 10");
        console.log("Platforms:", platforms);
        
        const brands = await queryClickHouse("SELECT DISTINCT Brand FROM rb_pdp_olap LIMIT 10");
        console.log("Brands:", brands);

        const products = await queryClickHouse("SELECT Product, count(*) as count FROM rb_pdp_olap GROUP BY Product ORDER BY count DESC LIMIT 10");
        console.log("Top Products:", products);

        const dateRange = await queryClickHouse("SELECT min(DATE) as min_date, max(DATE) as max_date FROM rb_pdp_olap");
        console.log("Date Range:", dateRange);
    } catch (err) {
        console.error(err);
    }
}
main();
