import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: 'mars_petcare',
});

async function run() {
    try {
        console.log('--- Checking mars_petcare Data ---');

        const dateQuery = 'SELECT MIN(toDate(DATE)) as minDate, MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap';
        const dateRes = await client.query({ query: dateQuery, format: 'JSONEachRow' });
        const dates = await dateRes.json();
        console.log('Date range in rb_pdp_olap:', dates[0]);

        const platformQuery = 'SELECT DISTINCT Platform, COUNT() as count FROM rb_pdp_olap GROUP BY Platform';
        const platformRes = await client.query({ query: platformQuery, format: 'JSONEachRow' });
        const platforms = await platformRes.json();
        console.log('Platforms in rb_pdp_olap:', platforms);

        const locationQuery = 'SELECT DISTINCT Location FROM rb_pdp_olap LIMIT 10';
        const locationRes = await client.query({ query: locationQuery, format: 'JSONEachRow' });
        const locations = await locationRes.json();
        console.log('Sample locations in rb_pdp_olap:', locations.map(l => l.Location));

        const msDateQuery = 'SELECT MIN(toDate(created_on)) as minDate, MAX(toDate(created_on)) as maxDate FROM rb_ms_olap';
        const msDateRes = await client.query({ query: msDateQuery, format: 'JSONEachRow' });
        const msDates = await msDateRes.json();
        console.log('Date range in rb_ms_olap:', msDates[0]);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

run();
