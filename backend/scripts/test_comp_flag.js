import { createClient } from '@clickhouse/client';

const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
});
async function run() {
    const rs = await client.query({ 
        query: "SELECT Brand, Comp_flag, sum(toFloat64OrZero(replaceRegexpAll(toString(Ad_Spend), '[^0-9.-]', ''))) as spend FROM rb_pdp_olap WHERE Brand='Oral-B' GROUP BY Brand, Comp_flag", 
        format: 'JSONEachRow' 
    });
    console.log(await rs.json());
    process.exit(0);
}
run();
