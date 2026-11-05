import { queryClickHouse } from '../config/clickhouse.js';

async function testFilterApi() {
    try {
        const pdpTable = 'emami.rb_pdp';
        const dateCol = 'created_on';

        const minMaxQuery = `SELECT formatDateTime(min(${dateCol}), '%Y-%m-%d') AS minDate, formatDateTime(max(${dateCol}), '%Y-%m-%d') AS maxDate FROM ${pdpTable} WHERE ${dateCol} IS NOT NULL`;
        const minMaxRes = await queryClickHouse(minMaxQuery);
        console.log("Promo minMaxRes:", minMaxRes);

        const dateQuery = `SELECT DISTINCT toDate(pdp_crawl_date) as DateStr FROM ${pdpTable} WHERE pdp_crawl_date IS NOT NULL ORDER BY DateStr DESC`;
        const datesRes = await queryClickHouse(dateQuery);
        console.log("Raw Data dates count:", datesRes.length);
        console.log("Raw Data dates top 5:", datesRes.slice(0, 5));
        console.log("Raw Data dates bottom 5:", datesRes.slice(-5));

    } catch (err) {
        console.error(err);
    }
}

testFilterApi();
