import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { createClient } from '@clickhouse/client';

async function run() {
    try {
        const client = createClient({
            url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || '',
            request_timeout: 120000,
        });
        
        console.log("Fetching list of databases...");
        const dbResult = await client.query({
            query: 'SHOW DATABASES',
            format: 'JSONEachRow'
        });
        const databases = await dbResult.json();
        console.log("Databases:", databases.map(r => r.name));

        for (const db of databases) {
            const dbName = db.name;
            if (['system', 'information_schema', 'default'].includes(dbName)) continue;
            
            try {
                const checkClient = createClient({
                    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
                    username: process.env.CLICKHOUSE_USER || 'default',
                    password: process.env.CLICKHOUSE_PASSWORD || '',
                    database: dbName,
                });
                
                const tableResult = await checkClient.query({
                    query: "SHOW TABLES",
                    format: 'JSONEachRow'
                });
                const tables = await tableResult.json();
                const tableNames = tables.map(t => t.name);
                
                if (tableNames.includes('rb_pdp_week')) {
                    console.log(`FOUND IT! Database '${dbName}' has table 'rb_pdp_week'!`);
                    console.log("Describing rb_pdp_week in db:", dbName);
                    const descResult = await checkClient.query({
                        query: "DESCRIBE rb_pdp_week",
                        format: 'JSONEachRow'
                    });
                    const desc = await descResult.json();
                    console.table(desc.map(c => ({ name: c.name, type: c.type })));
                } else if (tableNames.some(t => t.toLowerCase().includes('week'))) {
                    console.log(`Database '${dbName}' has tables with 'week':`, tableNames.filter(t => t.toLowerCase().includes('week')));
                }
            } catch (err) {
                console.error(`Error checking db ${dbName}:`, err.message);
            }
        }
    } catch (err) {
        console.error("Error:", err);
    }
}
run();
