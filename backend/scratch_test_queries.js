/**
 * FINAL FIX: Seed platform data for DEV users missing it.
 * Uses the same "closest db_id within 1000" BigInt fuzzy matching
 * that adminService.js uses — handles corrupted/truncated db_id values in tb_user.
 *
 * Safety: Only ALTER TABLE UPDATE — zero deletes.
 */

import { createClient } from '@clickhouse/client';

const DEV_URL  = 'http://13.203.251.97:8123';
const USER     = 'sanyam_m';
const PASS     = 'Sanyan_121@45';
const ADMIN_DB = 'admin_master';

const devClient = createClient({ url: DEV_URL, username: USER, password: PASS, database: ADMIN_DB, request_timeout: 60000 });

async function qStr(sql) {
    const r = await devClient.query({ query: sql, format: 'JSONStringsEachRow' });
    return r.json();
}

// Replicate adminService.js fuzzy db_id matching (BigInt-safe)
function resolveDbName(userDbIdStr, dbMap) {
    // Try exact match first
    if (dbMap.has(userDbIdStr)) return dbMap.get(userDbIdStr);
    
    // Fuzzy fallback: find closest within 1000
    let closestDb = null;
    let closestDiff = BigInt('99999999');
    try {
        const userBig = BigInt(userDbIdStr);
        for (const [dbId, name] of dbMap.entries()) {
            const dbBig = BigInt(dbId);
            const diff = userBig > dbBig ? userBig - dbBig : dbBig - userBig;
            if (diff < closestDiff) {
                closestDiff = diff;
                closestDb = name;
            }
        }
    } catch { return null; }

    return closestDiff < BigInt('1000') ? closestDb : null;
}

// Cache platforms per db_name
const platformCache = {};
async function getPlatforms(dbName) {
    if (platformCache[dbName] !== undefined) return platformCache[dbName];
    try {
        const check = await qStr(`EXISTS TABLE ${dbName}.rb_platform`);
        const exists = check[0]?.result === '1';
        if (!exists) { platformCache[dbName] = []; return []; }
        const rows = await qStr(`SELECT DISTINCT lower(pf_name) as pf_name FROM ${dbName}.rb_platform WHERE pf_name != ''`);
        platformCache[dbName] = rows.map(r => r.pf_name).filter(Boolean);
        return platformCache[dbName];
    } catch (e) {
        console.warn(`  ⚠ Could not read ${dbName}.rb_platform: ${e.message}`);
        platformCache[dbName] = [];
        return [];
    }
}

async function main() {
    console.log('════════════════════════════════════════════════════════════');
    console.log('  DEV Platform Fix — BigInt fuzzy match (within 1000)');
    console.log('  Only users MISSING "platform" key will be updated.');
    console.log('════════════════════════════════════════════════════════════\n');

    // 1. Build db_id → db_name map (all as BigInt-safe strings via JSONStringsEachRow)
    const dbRows = await qStr(`SELECT toString(db_id) as db_id, db_name FROM ${ADMIN_DB}.tb_database`);
    const dbMap = new Map(dbRows.map(r => [r.db_id, r.db_name]));
    console.log(`Loaded ${dbMap.size} databases.\n`);

    // 2. Fetch all DEV users
    const users = await qStr(`SELECT toString(id) as id, user_email, toString(db_id) as db_id, tab_permissions FROM ${ADMIN_DB}.tb_user`);
    console.log(`Found ${users.length} rows on DEV.\n`);

    let updated = 0, skipped = 0, noDb = 0, noPlat = 0;

    for (const user of users) {
        let perms;
        try { perms = JSON.parse(user.tab_permissions || '{}'); }
        catch { skipped++; continue; }

        // Skip if platform already present
        if (perms.platform && typeof perms.platform === 'object' && Object.keys(perms.platform).length > 0) {
            skipped++;
            continue;
        }

        // Resolve db_name using fuzzy BigInt matching
        const dbName = resolveDbName(user.db_id, dbMap);
        if (!dbName) { noDb++; continue; }

        // Get platforms
        const platforms = await getPlatforms(dbName);
        if (platforms.length === 0) { noPlat++; continue; }

        // Build platform object (all true by default)
        const platformObj = {};
        platforms.forEach(p => { platformObj[p] = true; });

        // Inject — do NOT touch any other key
        perms.platform = platformObj;

        const jsonStr = JSON.stringify(perms).replace(/'/g, "\\'");
        await devClient.command({
            query: `ALTER TABLE ${ADMIN_DB}.tb_user UPDATE tab_permissions = '${jsonStr}' WHERE toString(id) = '${user.id}'`
        });
        console.log(`  ✓ [${dbName}] ${user.user_email} → [${platforms.join(', ')}]`);
        updated++;
    }

    console.log(`\nSummary: ${updated} updated | ${skipped} already had platforms | ${noDb} no DB found | ${noPlat} no rb_platform`);

    // Wait for mutations
    console.log('\nWaiting for ClickHouse mutations to complete...');
    let attempts = 0;
    while (attempts < 20) {
        const p = await devClient.query({ query: `SELECT count() as cnt FROM system.mutations WHERE is_done = 0 AND table = 'tb_user'`, format: 'JSONEachRow' }).then(r => r.json());
        const cnt = parseInt(p[0]?.cnt || '0', 10);
        if (cnt === 0) { console.log('✅ All mutations complete.'); break; }
        console.log(`  Pending: ${cnt}. Waiting 2s...`);
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
    }

    // Verify Mars user
    console.log('\n═══ Verification: Mars@trailytics.com ═══');
    const verify = await qStr(`SELECT tab_permissions FROM ${ADMIN_DB}.tb_user WHERE user_email = 'Mars@trailytics.com' ORDER BY last_login DESC LIMIT 1`);
    if (verify[0]) {
        const p = JSON.parse(verify[0].tab_permissions || '{}');
        console.log(p.platform
            ? `✅ platform: ${JSON.stringify(p.platform)}`
            : '❌ platform key STILL missing'
        );
    }

    await devClient.close();
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
