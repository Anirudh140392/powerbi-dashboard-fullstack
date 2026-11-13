/**
 * API Logger Scheduler Service
 * 
 * - Sharp 09:00 AM IST: Automatically runs API health checks and log monitoring
 *   across all active databases, and immediately dispatches the API Alert Email Report
 *   with present-day data upon completion.
 * - 01:00 AM IST: Nightly retention cleanup of old/expired logs (keeps ClickHouse lean).
 */

import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

import { executeFullApiHealthCheck } from './apiTestRunner.js';
import { ensureApiLogsSchema, cleanupOldLogs } from './apiLoggerRepository.js';
import { sendApiAlertReport } from './apiAlertReportService.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const API_HEALTH_CRON = process.env.API_HEALTH_CRON || '0 9 * * *'; // Sharp 09:00 AM IST
const CLEANUP_CRON = process.env.API_LOGGER_CRON || '0 1 * * *';    // 01:00 AM IST
const TIMEZONE = process.env.API_LOGGER_TZ || 'Asia/Kolkata';

let healthAndReportTask = null;
let nightlyCleanupTask = null;
let isInitialized = false;

/**
 * Initialize background schedulers for API monitoring.
 * Called automatically during backend application boot.
 */
export async function initApiLoggerScheduler() {
    if (isInitialized) {
        console.log('[ApiLoggerScheduler] Scheduler already initialized, skipping duplicate init.');
        return;
    }

    isInitialized = true;
    console.log('[ApiLoggerScheduler] ============================================================');
    console.log('[ApiLoggerScheduler] Initializing Automated API Health & Alert Schedulers:');
    console.log(`[ApiLoggerScheduler] 1. Sharp 09:00 AM IST Health Test & Auto-Mail Cron: "${API_HEALTH_CRON}" (${TIMEZONE})`);
    console.log(`[ApiLoggerScheduler] 2. 01:00 AM IST Retention Cleanup Cron: "${CLEANUP_CRON}" (${TIMEZONE})`);
    console.log('[ApiLoggerScheduler] ============================================================');

    // Startup maintenance: Ensure schema integrity and run initial cleanup
    try {
        await ensureApiLogsSchema();
        await cleanupOldLogs();
    } catch (err) {
        console.error('[ApiLoggerScheduler] Startup schema verification note:', err.message);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Scheduler: Sharp 09:00 AM IST (Automated Health Test + Auto-Send Email)
    // ──────────────────────────────────────────────────────────────────────────
    if (cron.validate(API_HEALTH_CRON)) {
        healthAndReportTask = cron.schedule(
            API_HEALTH_CRON,
            async () => {
                const nowIST = dayjs().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
                console.log(`[ApiLoggerScheduler] ⏰ Sharp 09:00 AM IST Cron triggered at ${nowIST} (${TIMEZONE}).`);
                console.log('[ApiLoggerScheduler] Step 1/2: Running automated API health check suite across all databases...');

                try {
                    // Step 1: Run comprehensive API health check across all active databases & permitted pages
                    const testSummary = await executeFullApiHealthCheck();
                    console.log(`[ApiLoggerScheduler] ✅ Health check completed. Tested ${testSummary.totalTested || 0} endpoints across ${testSummary.databasesTested?.length || 0} databases.`);

                    // Step 2: Automatically dispatch email report once tests are completed, containing ONLY present-day data!
                    console.log('[ApiLoggerScheduler] Step 2/2: Tests finished! Automatically dispatching daily API Alert Email Report for present day...');
                    const emailResult = await sendApiAlertReport({ dateScope: 'today' });
                    console.log('[ApiLoggerScheduler] 📧 Present-day API Alert Email Report dispatched successfully:', emailResult);
                } catch (cycleErr) {
                    console.error('[ApiLoggerScheduler] ❌ Error during 09:00 AM automated test & email cycle:', cycleErr.message);
                }
            },
            {
                scheduled: true,
                timezone: TIMEZONE,
            }
        );
        console.log(`[ApiLoggerScheduler] ✅ Sharp 09:00 AM IST Health Test & Auto-Mail Cron registered successfully.`);
    } else {
        console.error(`[ApiLoggerScheduler] Invalid API_HEALTH_CRON expression: "${API_HEALTH_CRON}".`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Scheduler: 01:00 AM IST (Nightly Retention Cleanup)
    // ──────────────────────────────────────────────────────────────────────────
    if (cron.validate(CLEANUP_CRON)) {
        nightlyCleanupTask = cron.schedule(
            CLEANUP_CRON,
            async () => {
                console.log('[ApiLoggerScheduler] ⏰ 01:00 AM IST Nightly Retention Cleanup triggered.');
                try {
                    await cleanupOldLogs();
                    console.log('[ApiLoggerScheduler] ✅ Nightly retention cleanup completed.');
                } catch (cleanErr) {
                    console.error('[ApiLoggerScheduler] Error during nightly cleanup:', cleanErr.message);
                }
            },
            {
                scheduled: true,
                timezone: TIMEZONE,
            }
        );
        console.log(`[ApiLoggerScheduler] ✅ 01:00 AM IST Nightly Retention Cleanup Cron registered successfully.`);
    } else {
        console.error(`[ApiLoggerScheduler] Invalid CLEANUP_CRON expression: "${CLEANUP_CRON}".`);
    }
}

/**
 * Stop all scheduled cron tasks (for graceful shutdown).
 */
export function stopApiLoggerScheduler() {
    if (healthAndReportTask) {
        healthAndReportTask.stop();
        healthAndReportTask = null;
    }
    if (nightlyCleanupTask) {
        nightlyCleanupTask.stop();
        nightlyCleanupTask = null;
    }
    isInitialized = false;
    console.log('[ApiLoggerScheduler] All scheduled tasks stopped.');
}
