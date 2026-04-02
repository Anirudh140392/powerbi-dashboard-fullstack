
import { createClient } from '@clickhouse/client';

const client = createClient({
    host: 'http://13.200.55.131:8123',
    user: 'readonly_user',
    password: 'Readonly@123',
    database: 'mamaearth',
});

async function checkSchema() {
    try {
        const resultSet = await client.query({
            query: 'DESCRIBE watchtower_agg_daily',
            format: 'JSONEachRow',
        });
        const dataset = await resultSet.json();
        console.log(JSON.stringify(dataset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

checkSchema();
