// Migration: Add db_status and tab_permissions columns to tb_user
import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.ADMIN_DB || 'admin_master',
});

async function run() {
    try {
        // First, check existing columns
        const cols = await client.query({ query: "DESCRIBE TABLE tb_user", format: 'JSONEachRow' });
        const colData = await cols.json();
        const colNames = colData.map(c => c.name);
        console.log('Existing columns:', colNames.join(', '));

        // Add db_status if not exists
        if (!colNames.includes('db_status')) {
            console.log('Adding db_status column...');
            await client.command({ query: "ALTER TABLE tb_user ADD COLUMN IF NOT EXISTS db_status String DEFAULT 'active'" });
            console.log('db_status column added.');
        } else {
            console.log('db_status column already exists.');
        }

        // Add tab_permissions if not exists
        if (!colNames.includes('tab_permissions')) {
            console.log('Adding tab_permissions column...');
            await client.command({ query: "ALTER TABLE tb_user ADD COLUMN IF NOT EXISTS tab_permissions String DEFAULT ''" });
            console.log('tab_permissions column added.');
        } else {
            console.log('tab_permissions column already exists.');
        }

        // Verify
        const cols2 = await client.query({ query: "DESCRIBE TABLE tb_user", format: 'JSONEachRow' });
        const colData2 = await cols2.json();
        console.log('\nFinal table schema:');
        colData2.forEach(c => console.log(`  ${c.name}: ${c.type} (default: ${c.default_expression || 'none'})`));

        console.log('\nMigration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.close();
    }
}

run();
