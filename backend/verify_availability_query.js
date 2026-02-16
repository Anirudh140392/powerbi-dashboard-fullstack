
import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
    request_timeout: 30000,
});

async function verifyQuery() {
    console.log('Starting verification...');
    try {
        const query = `
            SELECT 
                t.DATE, t.Platform, t.Brand, t.Location as City, t.Category as Format, t.Product,
                round(avg(toFloat64OrZero(t.listing_percentage)), 2) as Listing_Percentage
            FROM rb_pdp_olap t
            LIMIT 5
        `;

        console.log('Executing Query:');
        console.log(query);

        const result = await clickhouse.query({
            query: query,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('Query Successful!');
        console.log('Returned ' + data.length + ' rows.');
        if (data.length > 0) {
            console.log('Sample Row:', JSON.stringify(data[0], null, 2));
        }

    } catch (err) {
        console.log('❌ ClickHouse query failed: ' + err.message);
        if (err.cause) console.log('Cause: ' + JSON.stringify(err.cause));
    }
}

verifyQuery().then(() => console.log('Done')).catch(e => console.log('Fatal: ' + e));
