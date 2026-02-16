
import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

async function verify() {
    console.log('Starting simplified verification...');
    try {
        const query = `
            SELECT 
                t.DATE, t.Platform, 
                round(avg(toFloat64OrZero(t.listing_percentage)), 2) as Listing_Percentage
            FROM rb_pdp_olap t
            LIMIT 5
        `;

        console.log('Sending query...');
        const data = await queryClickHouse(query);
        console.log('--- SUCCESS ---');
        console.log(JSON.stringify(data[0], null, 2));

    } catch (err) {
        console.error('--- FAILURE ---');
        console.error(err.message);
    }
}

verify();
