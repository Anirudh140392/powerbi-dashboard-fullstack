// update_tab_permissions.js
// Updates tab_permissions column in tb_user to include flat platform keys
// like: "platform_amazon": true, "platform_flipkart": true, etc.
// Only the platforms that exist in each client's own database are added.
// Write-access via ClickHouse IP: 13.203.251.97

import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const ADMIN_DB = process.env.ADMIN_DB || 'admin_master';
const CH_URL = process.env.CLICKHOUSE_URL || 'http://13.203.251.97:8123';
const CH_USER = process.env.CLICKHOUSE_USER || 'default';
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || '';

// Admin DB client
const adminClient = createClient({
    url: CH_URL, username: CH_USER, password: CH_PASS,
    database: ADMIN_DB, request_timeout: 60000,
});

async function queryAdmin(query) {
    const result = await adminClient.query({ query, format: 'JSONEachRow' });
    return await result.json();
}

// Query a specific client database
async function queryClientDB(dbName, query) {
    const client = createClient({
        url: CH_URL, username: CH_USER, password: CH_PASS,
        database: dbName, request_timeout: 30000,
    });
    try {
        const result = await client.query({ query, format: 'JSONEachRow' });
        const data = await result.json();
        await client.close();
        return data;
    } catch (err) {
        await client.close();
        throw err;
    }
}

// Normalize a platform name to a flat key: "Amazon" -> "platform_amazon"
function platformKey(name) {
    return 'platform_' + name.trim().toLowerCase().replace(/[\s\-]+/g, '_');
}

(async () => {
    try {
        // 1. Build db_id -> db_name mapping
        console.log('Fetching databases from tb_database...');
        const databases = await queryAdmin(`SELECT DISTINCT db_name, toString(db_id) as db_id FROM tb_database`);
        const dbMap = new Map();
        databases.forEach(db => dbMap.set(db.db_id, db.db_name));
        console.log(`Found ${databases.length} databases:`, [...dbMap.values()].join(', '));

        // 2. Fetch all users with their latest tab_permissions and db_id
        console.log('\nFetching users from tb_user...');
        const users = await queryAdmin(`
            SELECT 
                user_email,
                argMax(toString(db_id), last_login) as db_id,
                argMaxIf(tab_permissions, last_login, tab_permissions != '') as tab_permissions
            FROM tb_user
            GROUP BY user_email
        `);
        console.log(`Found ${users.length} distinct users.`);

        // 3. Cache: db_name -> platforms list (so we don't query the same DB multiple times)
        const platformCache = new Map();

        async function getPlatformsForDB(dbName) {
            if (platformCache.has(dbName)) return platformCache.get(dbName);
            try {
                // Try to get platforms from rca_sku_dim
                const rows = await queryClientDB(dbName, `
                    SELECT DISTINCT platform 
                    FROM rca_sku_dim 
                    WHERE platform IS NOT NULL AND platform != '' 
                    ORDER BY platform
                `);
                const platforms = rows.map(r => r.platform).filter(Boolean);
                platformCache.set(dbName, platforms);
                console.log(`  DB "${dbName}" has platforms: [${platforms.join(', ')}]`);
                return platforms;
            } catch (err) {
                console.warn(`  DB "${dbName}" — could not fetch platforms: ${err.message}`);
                platformCache.set(dbName, []);
                return [];
            }
        }

        // 4. Process each user
        let updatedCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                // Resolve db_name from db_id
                let dbName = null;
                if (dbMap.has(user.db_id)) {
                    dbName = dbMap.get(user.db_id);
                } else {
                    // BigInt precision fallback
                    try {
                        const uid = BigInt(user.db_id);
                        for (const [id, name] of dbMap.entries()) {
                            const diff = uid > BigInt(id) ? uid - BigInt(id) : BigInt(id) - uid;
                            if (diff < BigInt('1000')) { dbName = name; break; }
                        }
                    } catch (_) {}
                }

                if (!dbName) {
                    console.log(`  ⚠ ${user.user_email} — no matching DB for db_id=${user.db_id}, skipping`);
                    continue;
                }

                // Get the platforms that exist for this client's DB
                const platforms = await getPlatformsForDB(dbName);

                // Parse existing tab_permissions
                let perms = {};
                if (user.tab_permissions && user.tab_permissions.trim()) {
                    try { perms = JSON.parse(user.tab_permissions); } catch (_) {}
                }

                // Remove old nested platform_permissions key if it exists
                delete perms.platform_permissions;

                // Remove any old platform_xxx keys to start clean
                for (const key of Object.keys(perms)) {
                    if (key.startsWith('platform_')) delete perms[key];
                }

                // Add flat platform keys for this client's platforms (all default to true)
                for (const p of platforms) {
                    perms[platformKey(p)] = true;
                }

                // Escape and update
                const jsonStr = JSON.stringify(perms).replace(/'/g, "\\'");
                await queryAdmin(`
                    ALTER TABLE tb_user 
                    UPDATE tab_permissions = '${jsonStr}' 
                    WHERE user_email = '${user.user_email}'
                `);
                updatedCount++;

                const platKeys = platforms.map(p => platformKey(p)).join(', ');
                console.log(`  ✓ ${user.user_email} (${dbName}): ${platKeys || '(no platforms)'}`);
            } catch (err) {
                console.error(`  ✗ ${user.user_email}: ${err.message}`);
                errorCount++;
            }
        }

        console.log(`\n=== Done! Updated: ${updatedCount}, Errors: ${errorCount} ===`);

        // 5. Verify a sample
        console.log('\n--- Verification (sample) ---');
        const sample = await queryAdmin(`
            SELECT user_email, tab_permissions 
            FROM tb_user 
            ORDER BY last_login DESC
            LIMIT 5
        `);
        for (const row of sample) {
            const tp = row.tab_permissions || '(empty)';
            console.log(`${row.user_email}: ${tp.substring(0, 300)}`);
        }

        await adminClient.close();
    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    }
})();
