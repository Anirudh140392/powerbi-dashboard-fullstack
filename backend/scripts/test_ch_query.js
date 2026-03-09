import { createClient } from '@clickhouse/client';
import dayjs from 'dayjs';

const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
});
async function run() {
    const endDate = dayjs();
    const startDate = endDate.clone().subtract(30, 'days');
    const startStr = startDate.format('YYYY-MM-DD');
    const endStr = endDate.format('YYYY-MM-DD');
    const currConds = `toDate(DATE) BETWEEN '${startStr}' AND '${endStr}' AND toString(Comp_flag) = '1'`;

    const q = `
        SELECT Brand,
            SUM(ifNull(toFloat64OrZero(replaceRegexpAll(toString(Ad_Spend), '[^0-9.-]', '')), 0)) as total_spend,
            SUM(ifNull(toFloat64OrZero(replaceRegexpAll(toString(Ad_sales), '[^0-9.-]', '')), 0)) as total_ad_sales,
            SUM(ifNull(toFloat64OrZero(replaceRegexpAll(toString(Ad_Impressions), '[^0-9.-]', '')), 0)) as total_impressions
        FROM rb_pdp_olap
        WHERE ${currConds}
        GROUP BY Brand
    `;
    const rs = await client.query({ query: q, format: 'JSONEachRow' });
    console.log(await rs.json());
    process.exit(0);
}
run();
