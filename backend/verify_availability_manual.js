
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'readonly_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Readonly@123',
    database: process.env.CLICKHOUSE_DB || 'colpal',
    request_timeout: 30000,
});

async function verify() {
    console.log('Starting manual verification...');
    try {
        // Query matching the modification in reportsController.js (simplified)
        const query = `
            SELECT 
                t.DATE, t.Platform, t.Brand, t.Location as City, t.Category as Format, t.Product,
                round(avg(toFloat64OrZero(t.listing_percent)), 2) as Listing_Percentage
            FROM rb_pdp_olap t
            LIMIT 5
        `;

        console.log('Sending query...');
        const result = await clickhouse.query({
            query: query,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('--- SUCCESS ---');
        console.log('Returned ' + data.length + ' rows.');
        if (data.length > 0) {
            console.log(JSON.stringify(data[0], null, 2));
        }

    } catch (err) {
        console.error('--- FAILURE ---');
        console.error(err.message);
    }
}

verify();
