import { createClient } from '@clickhouse/client';
const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
});
async function run() {
    const rs = await client.query({
        query: "SELECT Brand, sum(toFloat64OrZero(replaceRegexpAll(toString(Sales), '[^0-9.-]', ''))) as Sales, sum(toFloat64OrZero(replaceRegexpAll(toString(Ad_sales), '[^0-9.-]', ''))) as Ad_Sales FROM rb_pdp_olap GROUP BY Brand LIMIT 20",
        format: 'JSONEachRow'
    });
    console.log(await rs.json());
    process.exit(0);
}
run();
