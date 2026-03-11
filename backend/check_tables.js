import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'readonly_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Readonly@123',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

async function checkTables() {
    try {
        const resultSet = await client.query({
            query: "SHOW DATABASES",
            format: 'JSONEachRow',
        });
        const dbs = await resultSet.json();
        console.log('Databases:', dbs);

        try {
            const descSet = await client.query({
                query: "DESCRIBE rb_kw_pdp",
                format: 'JSONEachRow',
            });
            const schema = await descSet.json();
            console.log('rb_kw_pdp Schema:', schema);
        } catch (e) {
            console.log('rb_kw_pdp does not exist in CURRENT db.');
        }
        const dataset = await resultSet.json();
        console.log('Tables found:', dataset);

        const tableToCheck = 'rb_kw_pdp';
        const existsQuery = `EXISTS TABLE ${tableToCheck}`;
        const existsResult = await client.query({
            query: existsQuery,
            format: 'JSONEachRow',
        });
        const existsData = await existsResult.json();
        console.log(`${tableToCheck} exists:`, existsData[0].result);

        if (existsData[0].result === 1) {
            const schemaQuery = `DESCRIBE TABLE ${tableToCheck}`;
            const schemaResult = await client.query({
                query: schemaQuery,
                format: 'JSONEachRow',
            });
            const schemaData = await schemaResult.json();
            console.log(`Schema for ${tableToCheck}:`, schemaData);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

checkTables();
