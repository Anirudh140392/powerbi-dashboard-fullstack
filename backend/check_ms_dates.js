import { queryClickHouse } from './src/config/clickhouse.js';

async function checkMsData() {
    try {
        console.log('--- Checking min/max dates in rb_ms_olap ---');
        const dates = await queryClickHouse(`SELECT MIN(toDate(created_on)) as min_d, MAX(toDate(created_on)) as max_d FROM rb_ms_olap`);
        console.log('rb_ms_olap dates:', dates);

        console.log('--- Checking min/max dates in rb_pdp_olap ---');
        const pdpDates = await queryClickHouse(`SELECT MIN(toDate(DATE)) as min_d, MAX(toDate(DATE)) as max_d FROM rb_pdp_olap`);
        console.log('rb_pdp_olap dates:', pdpDates);

        console.log('\n--- Count by platform in rb_ms_olap ---');
        const platCounts = await queryClickHouse(`SELECT platform, count() as cnt, SUM(toFloat64OrZero(toString(sales))) as total_sales FROM rb_ms_olap GROUP BY platform`);
        console.log(platCounts);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkMsData();
