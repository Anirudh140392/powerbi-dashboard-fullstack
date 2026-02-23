import { createClient } from '@clickhouse/client';
const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
});
async function run() {
    const rs = await client.query({
        query: "SELECT Brand, SUM(toFloat64OrZero(replaceRegexpAll(toString(Sales), '[^0-9.-]', ''))) as sum_sales FROM rb_pdp_olap GROUP BY Brand HAVING sum_sales > 0 ORDER BY sum_sales DESC LIMIT 10",
        format: 'JSONEachRow'
    });
    console.log(await rs.json());
    process.exit(0);
}
run();
