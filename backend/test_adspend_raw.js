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
            SELECT DATE, Ad_Spend, Sales, Ad_sales
            FROM rb_pdp_olap
            WHERE Brand='Oral-B'
            ORDER BY DATE DESC
            LIMIT 10
        `,
        format: 'JSONEachRow'
    });
    console.log(await rs.json());
    process.exit(0);
}
run();
