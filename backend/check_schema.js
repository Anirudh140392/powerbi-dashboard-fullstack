import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
});

async function checkSchema() {
    try {
        console.log('Checking rb_pdp_olap schema with hardcoded creds...');
        const resultSet = await client.query({
            query: 'DESCRIBE TABLE rb_pdp_olap',
            format: 'JSONEachRow',
        });
        const columns = await resultSet.json();
        console.log('Columns in rb_pdp_olap:');
        columns.forEach(col => console.log(`- ${col.name} (${col.type})`));
    } catch (err) {
        console.error('Error checking schema:', err);
    }
    process.exit(0);
}

checkSchema();
