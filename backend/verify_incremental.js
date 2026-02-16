
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
    console.log('Starting incremental verification...');

    // 1. Simple Count
    try {
        console.log('1. Checking connection and table existence...');
        const res1 = await clickhouse.query({ query: 'SELECT count() as c FROM rb_pdp_olap', format: 'JSONEachRow' });
        const data1 = await res1.json();
        console.log('Count:', data1[0].c);
    } catch (e) {
        console.error('Step 1 Failed:', e.message);
        return;
    }

    // 2. Check listing_percentage column content
    try {
        console.log('2. Checking listing_percentage column...');
        const res2 = await clickhouse.query({ query: 'SELECT listing_percentage FROM rb_pdp_olap LIMIT 5', format: 'JSONEachRow' });
        const data2 = await res2.json();
        console.log('Sample listing_percentage:', JSON.stringify(data2));
    } catch (e) {
        console.error('Step 2 Failed:', e.message);
    }

    // 3. Full Query Component
    try {
        console.log('3. Checking aggregation...');
        const query = `
            SELECT 
                t.DATE, 
                round(avg(toFloat64OrZero(t.listing_percentage)), 2) as Listing_Percentage
            FROM rb_pdp_olap t
            GROUP BY t.DATE
            LIMIT 5
        `;
        const res3 = await clickhouse.query({ query: query, format: 'JSONEachRow' });
        const data3 = await res3.json();
        console.log('Aggregation Result:', JSON.stringify(data3));
    } catch (e) {
        console.error('Step 3 Failed:', e.message);
    }
}

verify();
