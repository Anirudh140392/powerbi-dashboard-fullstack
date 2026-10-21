/**
 * API Logger Scheduler Service
 * Schedules the automated API testing job to run daily at 1:00 AM IST.
 * Ensures ClickHouse schema integrity on startup and performs automated retention cleanup.
 */

import cron from 'node-cron';
import { runPageTests } from './apiTestRunner.js';
import { ensureApiLogsSchema, cleanupOldLogs } from './apiLoggerRepository.js';

const CRON_EXPRESSION = process.env.API_LOGGER_CRON || '0 1 * * *'; // 01:00 AM
const TIMEZONE = process.env.API_LOGGER_TZ || 'Asia/Kolkata';

let scheduledTask = null;
let isInitialized = false;

/**
 * Initialize the API Logger scheduler.
 * Called once during backend application boot.
 */
export async function initApiLoggerScheduler() {
    if (isInitialized) {
        console.log('[ApiLoggerScheduler] Scheduler already initialized, skipping duplicate init.');
        return;
    }

    isInitialized = true;
    console.log(`[ApiLoggerScheduler] Initializing API Health Logger Scheduler...`);
    console.log(`[ApiLoggerScheduler] Cron Schedule: "${CRON_EXPRESSION}" (Timezone: ${TIMEZONE})`);

    // 1. Startup maintenance: Ensure schema and run backup cleanup
    try {
        await ensureApiLogsSchema();
        await cleanupOldLogs();
    } catch (err) {
        console.error('[ApiLoggerScheduler] Startup schema verification note:', err.message);
    }

    // 2. Validate cron expression
    if (!cron.validate(CRON_EXPRESSION)) {
        console.error(`[ApiLoggerScheduler] Invalid cron expression: "${CRON_EXPRESSION}". Cron disabled.`);
        return;
    }

    // 3. Register cron task
    try {
        scheduledTask = cron.schedule(
            CRON_EXPRESSION,
            async () => {
                console.log(`[ApiLoggerScheduler] ⏰ Cron triggered at 1:00 AM IST. Starting Pricing Analysis API tests...`);
                try {
                    await runPageTests('Pricing Analysis');
                } catch (runErr) {
                    console.error('[ApiLoggerScheduler] Cron test run execution error:', runErr.message);
                }
            },
            {
                scheduled: true,
                timezone: TIMEZONE,
            }
        );

        console.log(`[ApiLoggerScheduler] ✅ Cron task successfully registered for daily 01:00 AM IST runs.`);
    } catch (scheduleErr) {
        console.error('[ApiLoggerScheduler] Failed to schedule cron task:', scheduleErr.message);
    }
}

/**
 * Stop the scheduled cron task (e.g. for graceful shutdown).
 */
export function stopApiLoggerScheduler() {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
        isInitialized = false;
        console.log('[ApiLoggerScheduler] Scheduled task stopped.');
    }
}
