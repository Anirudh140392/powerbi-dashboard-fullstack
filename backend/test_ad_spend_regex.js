import { createClient } from '@clickhouse/client';
const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
});
async function run() {
    const rs = await client.query({ 
        query: `
            SELECT 
                SUM(ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)) as without_regex,
                SUM(ifNull(toFloat64OrZero(replaceRegexpAll(toString(Ad_Spend), '[^0-9.-]', '')), 0)) as with_regex
            FROM rb_pdp_olap
            WHERE Brand='Oral-B'
        `, 
        format: 'JSONEachRow' 
    });
    console.log(await rs.json());
    process.exit(0);
}
run();
