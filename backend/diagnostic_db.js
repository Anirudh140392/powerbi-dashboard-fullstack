import { createClient } from '@clickhouse/client';
import 'dotenv/config';
import fs from 'fs';

async function diagnose() {
    const dbs = ['default', 'mars', 'colpal'];
    const allResults = {};
    
    for (const db of dbs) {
        try {
            const client = createClient({
                url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
                username: process.env.CLICKHOUSE_USER || 'default',
                password: process.env.CLICKHOUSE_PASSWORD || '',
                database: db,
            });

            console.log(`Processing DB: ${db}`);
            const query = `
                SELECT 
                    brand_crawl, 
                    is_competitor_product, 
                    keyword_is_rb_product, 
                    count() as cnt 
                FROM rb_kw 
                GROUP BY brand_crawl, is_competitor_product, keyword_is_rb_product 
                ORDER BY cnt DESC 
                LIMIT 30
            `;
            const resultSet = await client.query({ query, format: 'JSONEachRow' });
            const res = await resultSet.json();
            allResults[db] = res;
            await client.close();
        } catch (e) {
            allResults[db] = { error: e.message };
        }
    }
    fs.writeFileSync('diag_results.json', JSON.stringify(allResults, null, 2));
    console.log('Results written to diag_results.json');
    process.exit(0);
}

diagnose();
