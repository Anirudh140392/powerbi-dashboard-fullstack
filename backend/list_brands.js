import { queryClickHouse } from './src/config/clickhouse.js';

async function listBrands() {
    try {
        console.log("--- Listing distinct brands from rb_pdp_olap ---");
        const brands = await queryClickHouse(`SELECT DISTINCT Brand FROM rb_pdp_olap LIMIT 20`);
        console.table(brands);

        console.log("\n--- Checking latest DATEs in rb_pdp_olap ---");
        const dates = await queryClickHouse(`SELECT max(toDate(DATE)) as max_date, min(toDate(DATE)) as min_date FROM rb_pdp_olap`);
        console.table(dates);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

listBrands();
