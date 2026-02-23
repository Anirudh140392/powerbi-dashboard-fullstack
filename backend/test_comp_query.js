import { createClient } from '@clickhouse/client';
import moment from 'moment';

const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
});
async function run() {
    const startDate = moment().startOf('month');
    const endDate = moment();
    
    // For MTD, dates
    const q = `
        SELECT Brand,
               any(Category) as brand_category,
               SUM(ifNull(toFloat64OrZero(replaceRegexpAll(toString(Sales), '[^0-9.-]', '')), 0)) as total_offtakes,
               SUM(ifNull(toFloat64OrZero(replaceRegexpAll(toString(Ad_Spend), '[^0-9.-]', '')), 0)) as total_spend,
               SUM(ifNull(toFloat64OrZero(replaceRegexpAll(toString(Ad_sales), '[^0-9.-]', '')), 0)) as total_ad_sales,
               SUM(ifNull(toFloat64OrZero(replaceRegexpAll(toString(Ad_Impressions), '[^0-9.-]', '')), 0)) as total_impressions,
               AVG(ifNull(toFloat64OrZero(replaceRegexpAll(toString(MRP), '[^0-9.-]', '')), 0)) as avg_price,
               count() as record_count
        FROM rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
        GROUP BY Brand
        HAVING Brand='Oral-B'
    `;
    const rs = await client.query({ query: q, format: 'JSONEachRow' });
    console.log(await rs.json());
    process.exit(0);
}
run();
