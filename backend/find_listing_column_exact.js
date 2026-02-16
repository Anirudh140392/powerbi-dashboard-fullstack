
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'readonly_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Readonly@123',
    database: process.env.CLICKHOUSE_DB || 'colpal',
});

async function findListingColumn() {
    try {
        console.log('Connecting to:', process.env.CLICKHOUSE_URL);
        const result = await clickhouse.query({
            query: "SELECT name FROM system.columns WHERE table = 'rb_pdp_olap' AND database = '" + (process.env.CLICKHOUSE_DB || 'colpal') + "'",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('Found columns matching "listing" (exact case):');
        data.forEach(row => {
            if (row.name.toLowerCase().includes('listing')) {
                console.log(`"${row.name}"`);
            }
        });
    } catch (err) {
        console.error('❌ ClickHouse query failed:', err.message);
    }
}

findListingColumn();
