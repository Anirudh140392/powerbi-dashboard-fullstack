
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
});

async function findListingColumn() {
    try {
        console.log('Connecting to:', process.env.CLICKHOUSE_URL);
        const result = await clickhouse.query({
            query: "SELECT name FROM system.columns WHERE table = 'rb_pdp_olap' AND database = '" + (process.env.CLICKHOUSE_DB || 'colpal') + "'",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('Found columns matching "listing":');
        data.forEach(row => {
            if (row.name.toLowerCase().includes('listing')) {
                console.log(row.name);
            }
        });
    } catch (err) {
        console.error('❌ ClickHouse query failed:', err.message);
    }
}

findListingColumn();
