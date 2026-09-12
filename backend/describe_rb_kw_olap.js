import { createClient } from '@clickhouse/client';

const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'mars',
});

async function describeTable() {
    try {
        const result = await client.query({
            query: 'DESCRIBE TABLE rb_kw_olap',
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

describeTable();
