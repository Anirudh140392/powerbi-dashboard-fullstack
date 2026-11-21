#!/usr/bin/env node
/**
 * CLI Runner: Automated Daily API Alert Email Reporter (Node.js)
 * Usage:
 *   node backend/src/scripts/sendApiAlertReport.js [--dry-run] [--now]
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { sendApiAlertReport } from '../services/apiAlertReportService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from backend directory if not already
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const sendIfNoIssues = args.includes('--send-empty');

async function main() {
    try {
        console.log('[sendApiAlertReport.js] Triggering email report runner...');
        const result = await sendApiAlertReport({
            dryRun: isDryRun,
            sendIfNoIssues: sendIfNoIssues,
        });
        console.log('[sendApiAlertReport.js] Execution completed:', result);
        process.exit(0);
    } catch (err) {
        console.error('[sendApiAlertReport.js] ❌ Fatal error:', err.message);
        process.exit(1);
    }
}

main();
