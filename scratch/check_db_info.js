import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'kenil_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Kenil@Kavar0604',
    database: 'default',
});

async function run() {
    try {
        console.log("Fetching databases...");
        const dbResult = await client.query({
            query: 'SHOW DATABASES',
            format: 'JSONEachRow',
        });
        const databases = await dbResult.json();
        console.log("Databases:", databases.map(d => d.name));

        // Check if hm_stahl is in databases
        const hasHmstahl = databases.some(d => d.name === 'hm_stahl');
        console.log("Has hm_stahl?", hasHmstahl);

        if (hasHmstahl) {
            const hmstahlClient = createClient({
                url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
                username: process.env.CLICKHOUSE_USER || 'kenil_user',
                password: process.env.CLICKHOUSE_PASSWORD || 'Kenil@Kavar0604',
                database: 'hm_stahl',
            });

            console.log("\nChecking tables in hm_stahl...");
            const tablesResult = await hmstahlClient.query({
                query: 'SHOW TABLES',
                format: 'JSONEachRow',
            });
            const tables = await tablesResult.json();
            console.log("Tables in hm_stahl:", tables.map(t => t.name));

            if (tables.some(t => t.name === 'rb_kw_olap')) {
                console.log("\nDistinct platform_name in rb_kw_olap:");
                const platformsResult = await hmstahlClient.query({
                    query: 'SELECT DISTINCT platform_name FROM rb_kw_olap',
                    format: 'JSONEachRow',
                });
                const platforms = await platformsResult.json();
                console.log("Platforms in rb_kw_olap:", platforms.map(p => p.platform_name));
            }

            if (tables.some(t => t.name === 'rca_sku_dim')) {
                console.log("\nDistinct platform in rca_sku_dim:");
                const rcaPlatformsResult = await hmstahlClient.query({
                    query: 'SELECT DISTINCT platform FROM rca_sku_dim',
                    format: 'JSONEachRow',
                });
                const rcaPlatforms = await rcaPlatformsResult.json();
                console.log("Platforms in rca_sku_dim:", rcaPlatforms.map(p => p.platform));
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
