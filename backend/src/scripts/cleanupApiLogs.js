#!/usr/bin/env node
/**
 * CLI Runner: Automated 1:00 AM API Logs Database Retention Cleanup (Node.js)
 * Usage:
 *   node backend/src/scripts/cleanupApiLogs.js [--dry-run]
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { queryAdminDB } from '../config/adminClickhouse.js';
import { cleanupOldLogs } from '../services/apiLoggerRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function main() {
    try {
        console.log('======================================================================');
        console.log(`[cleanupApiLogs.js] Starting 01:00 AM Database Retention Cleanup at ${new Date().toISOString()}...`);
        console.log('======================================================================');

        // 1. Inspect current dates
        const dateRows = await queryAdminDB(`
            SELECT toDate(Date) as d, count(*) as count 
            FROM admin_master.api_logs 
            GROUP BY d 
            ORDER BY d DESC
        `);
        console.log('[cleanupApiLogs.js] Current dates in admin_master.api_logs:');
        for (const r of dateRows) {
            console.log(`  - Date: ${r.d} | Records: ${r.count}`);
        }

        // 2. Count rows eligible for deletion (older than yesterday)
        const countRes = await queryAdminDB(`
            SELECT count(*) as delete_count 
            FROM admin_master.api_logs 
            WHERE toDate(Date) < today() - 1
        `);
        const eligibleCount = Number(countRes[0]?.delete_count) || 0;
        console.log(`[cleanupApiLogs.js] Records eligible for deletion (toDate(Date) < today() - 1): ${eligibleCount}`);

        if (eligibleCount === 0) {
            console.log('[cleanupApiLogs.js] Table is already clean. No records older than retention threshold.');
            process.exit(0);
        }

        if (isDryRun) {
            console.log(`[cleanupApiLogs.js] [DRY RUN] Would delete ${eligibleCount} records. Skipping mutation.`);
            process.exit(0);
        }

        // 3. Execute mutation
        const res = await cleanupOldLogs();
        if (res.success) {
            console.log(`[cleanupApiLogs.js] ✅ Successfully submitted cleanup mutation for ${eligibleCount} records.`);
            process.exit(0);
        } else {
            console.error('[cleanupApiLogs.js] ❌ Cleanup returned error:', res.error);
            process.exit(1);
        }
    } catch (err) {
        console.error('[cleanupApiLogs.js] ❌ Fatal cleanup error:', err.message);
        process.exit(1);
    }
}

main();
