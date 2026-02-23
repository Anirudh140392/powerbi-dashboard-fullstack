import { createClient } from '@clickhouse/client';
const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
});
async function run() {
    const rs = await client.query({
        query: "DESCRIBE TABLE test_brand_MS",
        format: 'JSONEachRow'
    });
    console.log(await rs.json());
    process.exit(0);
}
run();
