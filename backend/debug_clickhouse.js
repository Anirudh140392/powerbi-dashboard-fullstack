import { createClient } from '@clickhouse/client';
import "dotenv/config";
import fs from 'fs';

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'default',
});

async function run() {
    try {
        console.log('Checking DISTINCT Category (uppercase)...');
        const result = await clickhouse.query({
            query: 'SELECT DISTINCT Category FROM rca_sku_dim WHERE status = 1 ORDER BY Category',
            format: 'JSONEachRow',
        });
        const data = await result.json();
        fs.writeFileSync('./debug_sku_dim_Category_uppercase.json', JSON.stringify(data, null, 2));
        console.log('Uppercase Categories written to debug_sku_dim_Category_uppercase.json');

        console.log('Checking a few rows...');
        const rowResult = await clickhouse.query({
            query: "SELECT brand_name, category, Category FROM rca_sku_dim WHERE status = 1 AND brand_name = 'Colgate' LIMIT 5",
            format: 'JSONEachRow',
        });
        const rowData = await rowResult.json();
        fs.writeFileSync('./debug_sku_dim_comparison.json', JSON.stringify(rowData, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
