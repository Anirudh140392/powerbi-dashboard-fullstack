import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

async function run() {
    try {
        console.log('--- Table Schema: rb_pdp_olap ---');
        const schema = await client.query({ query: 'DESCRIBE rb_pdp_olap', format: 'JSONEachRow' });
        const schemaData = await schema.json();
        console.log(schemaData.map(c => `${c.name} (${c.type})`).join(', '));

        console.log('\n--- Sample Data (Platform, Brand, Location, Category, Product_type) ---');
        const sample = await client.query({ 
            query: 'SELECT Platform, Brand, Location, Category, Product_type FROM rb_pdp_olap LIMIT 5', 
            format: 'JSONEachRow' 
        });
        const sampleData = await sample.json();
        console.log(JSON.stringify(sampleData, null, 2));

        console.log('\n--- Distinct Platforms ---');
        const platforms = await client.query({ query: 'SELECT DISTINCT Platform FROM rb_pdp_olap LIMIT 10', format: 'JSONEachRow' });
        console.log(await platforms.json());

        console.log('\n--- Distinct Categories & Product_types ---');
        const cats = await client.query({ query: 'SELECT DISTINCT Category, Product_type FROM rb_pdp_olap LIMIT 10', format: 'JSONEachRow' });
        console.log(await cats.json());

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
