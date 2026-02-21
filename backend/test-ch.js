import { createClient } from '@clickhouse/client';
const clickhouse = createClient({
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
    database: 'default',
    request_timeout: 10000,
});
async function test() {
    try {
        console.log("Connecting...");
        const result = await clickhouse.query({ query: 'SELECT 1', format: 'JSONEachRow' });
        const data = await result.json();
        console.log("Success:", data);
        
        console.log("Querying rb_pdp_olap count...");
        const countRes = await clickhouse.query({ query: 'SELECT count() FROM rb_pdp_olap', format: 'JSONEachRow' });
        console.log("Count:", await countRes.json());
        
        console.log("Querying max date...");
        const maxRes = await clickhouse.query({ query: 'SELECT MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap', format: 'JSONEachRow' });
        console.log("Max Date:", await maxRes.json());
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
