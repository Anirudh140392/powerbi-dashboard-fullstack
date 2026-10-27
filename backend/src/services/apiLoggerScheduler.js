/**
 * API Logger Scheduler Service
 * - 01:00 AM IST: Deletes day -1 / expired data from admin_master.api_logs and runs automated API health checks.
 * - 09:00 AM IST: Dispatches automated API Alert Email Report to recipients from admin_master.api_alert.
 */

import cron from 'node-cron';
import { runPageTests } from './apiTestRunner.js';
import { ensureApiLogsSchema, cleanupOldLogs } from './apiLoggerRepository.js';
import { getRegisteredPages } from '../config/apiLoggerRegistry.js';
import { sendApiAlertReport } from './apiAlertReportService.js';

const CLEANUP_TEST_CRON = process.env.API_LOGGER_CRON || '0 1 * * *'; // 01:00 AM IST
const EMAIL_REPORT_CRON = process.env.API_REPORT_CRON || '0 9 * * *'; // 09:00 AM IST
const TIMEZONE = process.env.API_LOGGER_TZ || 'Asia/Kolkata';

let testAndCleanupTask = null;
let emailReportTask = null;
let isInitialized = false;

/**
 * Initialize background schedulers for API monitoring.
 * Called during backend application boot.
 */
export async function initApiLoggerScheduler() {
    if (isInitialized) {
        console.log('[ApiLoggerScheduler] Scheduler already initialized, skipping duplicate init.');
        return;
    }

    isInitialized = true;
    console.log(`[ApiLoggerScheduler] Initializing API Health Schedulers...`);
    console.log(`[ApiLoggerScheduler] 1. 01:00 AM Cron (Cleanup day -1 data & run tests): "${CLEANUP_TEST_CRON}" (${TIMEZONE})`);
    console.log(`[ApiLoggerScheduler] 2. 09:00 AM Cron (Send API Alert email report): "${EMAIL_REPORT_CRON}" (${TIMEZONE})`);

    // Startup maintenance: Ensure schema integrity and run initial cleanup
    try {
        await ensureApiLogsSchema();
        await cleanupOldLogs();
    } catch (err) {
        console.error('[ApiLoggerScheduler] Startup schema verification note:', err.message);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Scheduler: 01:00 AM IST (Retention Cleanup + Automated Testing)
    // ──────────────────────────────────────────────────────────────────────────
    if (cron.validate(CLEANUP_TEST_CRON)) {
        testAndCleanupTask = cron.schedule(
            CLEANUP_TEST_CRON,
            async () => {
                console.log(`[ApiLoggerScheduler] ⏰ 01:00 AM IST Cron triggered.`);

                // Step A: Delete day -1 / expired records from admin_master.api_logs
                try {
                    console.log(`[ApiLoggerScheduler] 🧹 Running automated day -1 data cleanup in admin_master.api_logs...`);
                    await cleanupOldLogs();
                    console.log(`[ApiLoggerScheduler] ✅ Day -1 data cleanup completed.`);
                } catch (cleanErr) {
                    console.error('[ApiLoggerScheduler] Cleanup error during 01:00 AM cron:', cleanErr.message);
                }

                // Step B: Run daily automated API test suite for all registered pages
                const pages = getRegisteredPages();
                for (const pageName of pages) {
                    try {
                        console.log(`[ApiLoggerScheduler] 🚀 Executing scheduled tests for: "${pageName}"`);
                        await runPageTests(pageName);
                    } catch (runErr) {
                        console.error(`[ApiLoggerScheduler] Test run error for "${pageName}":`, runErr.message);
                    }
                }
            },
            {
                scheduled: true,
                timezone: TIMEZONE,
            }
        );
        console.log(`[ApiLoggerScheduler] ✅ 01:00 AM Cleanup & Test Cron registered successfully.`);
    } else {
        console.error(`[ApiLoggerScheduler] Invalid CLEANUP_TEST_CRON expression: "${CLEANUP_TEST_CRON}".`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Scheduler: 09:00 AM IST (Automated Daily API Alert Email Report)
    // ──────────────────────────────────────────────────────────────────────────
    if (cron.validate(EMAIL_REPORT_CRON)) {
        emailReportTask = cron.schedule(
            EMAIL_REPORT_CRON,
            async () => {
                console.log(`[ApiLoggerScheduler] ⏰ 09:00 AM IST Cron triggered. Dispatching API Alert Email Report (Pure JS)...`);
                try {
                    const result = await sendApiAlertReport();
                    console.log('[ApiLoggerScheduler] 📧 09:00 AM API Alert Report dispatched successfully:', result);
                } catch (err) {
                    console.error('[ApiLoggerScheduler] ❌ Error executing sendApiAlertReport:', err.message);
                }
            },
            {
                scheduled: true,
                timezone: TIMEZONE,
            }
        );
        console.log(`[ApiLoggerScheduler] ✅ 09:00 AM Daily Email Report Cron registered successfully.`);
    } else {
        console.error(`[ApiLoggerScheduler] Invalid EMAIL_REPORT_CRON expression: "${EMAIL_REPORT_CRON}".`);
    }
}

/**
 * Stop all scheduled cron tasks (for graceful shutdown).
 */
export function stopApiLoggerScheduler() {
    if (testAndCleanupTask) {
        testAndCleanupTask.stop();
        testAndCleanupTask = null;
    }
    if (emailReportTask) {
        emailReportTask.stop();
        emailReportTask = null;
    }
    isInitialized = false;
    console.log('[ApiLoggerScheduler] All scheduled tasks stopped.');
}
