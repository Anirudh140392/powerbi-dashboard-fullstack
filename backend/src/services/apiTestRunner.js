/**
 * API Test Runner Service
 * Executes automated HTTP requests against registered page APIs,
 * captures status codes, latencies, error messages, and saves results to ClickHouse.
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

import { getPageConfig } from '../config/apiLoggerRegistry.js';
import { 
    deleteLogsForDateAndPage, 
    insertLogs, 
    cleanupOldLogs 
} from './apiLoggerRepository.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';
const SLOW_THRESHOLD_MS = parseInt(process.env.API_LOGGER_SLOW_THRESHOLD_MS || '5000', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.API_LOGGER_TIMEOUT_MS || '30000', 10);
const TIMEZONE = process.env.API_LOGGER_TZ || 'Asia/Kolkata';
const CONCURRENCY_LIMIT = 3;

// Lock flag to prevent overlapping runs
let isRunInProgress = false;

/**
 * Generate internal service JWT with admin credentials to test protected routes.
 */
function generateServiceToken(targetDb) {
    const payload = {
        userId: 'api_logger_service',
        email: 'api-logger@trailytics.com',
        userName: 'API Logger Service',
        role: 'admin',
        dbName: targetDb,
        dbStatus: true,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Executes an array of async tasks with a maximum concurrency limit.
 */
async function asyncPool(limit, items, iteratorFn) {
    const ret = [];
    const executing = new Set();

    for (const item of items) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        ret.push(p);
        executing.add(p);

        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    return Promise.all(ret);
}

/**
 * Test a single endpoint and record results.
 */
async function testEndpoint({ endpoint, context, baseUrl, authHeaders, runId, runDateStr }) {
    const fullUrl = `${baseUrl}${endpoint.path}`;
    const params = endpoint.buildParams ? endpoint.buildParams(context) : {};

    console.log(`[ApiTestRunner] Testing: [${endpoint.method}] ${endpoint.path} (Segment: ${endpoint.segment})`);

    const startTime = Date.now();
    let statusCode = 0;
    let responseStatus = 'Failed';
    let errorMessage = '';
    let responseTimeMs = 0;

    try {
        const response = await axios({
            method: endpoint.method || 'GET',
            url: fullUrl,
            params,
            headers: authHeaders,
            timeout: REQUEST_TIMEOUT_MS,
            validateStatus: () => true, // Don't throw on non-2xx status codes so we capture status code
        });

        responseTimeMs = Date.now() - startTime;
        statusCode = response.status;

        const isHttpSuccess = statusCode >= 200 && statusCode < 300;
        const isBodySuccess = response.data?.success !== false;

        if (isHttpSuccess && isBodySuccess) {
            if (responseTimeMs > SLOW_THRESHOLD_MS) {
                responseStatus = 'Slow';
            } else {
                responseStatus = 'Success';
            }
        } else {
            responseStatus = 'Failed';
            if (!isHttpSuccess) {
                errorMessage = `HTTP ${statusCode}: ${response.statusText || 'Error response'}`;
            } else if (!isBodySuccess) {
                errorMessage = response.data?.error || response.data?.message || 'Response body flagged success=false';
            }
        }
    } catch (err) {
        responseTimeMs = Date.now() - startTime;
        responseStatus = 'Failed';

        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            statusCode = 0;
            errorMessage = `Request timed out after ${REQUEST_TIMEOUT_MS}ms`;
        } else if (err.response) {
            statusCode = err.response.status;
            errorMessage = `HTTP ${statusCode}: ${err.response.statusText || err.message}`;
        } else {
            statusCode = 0;
            errorMessage = err.message || 'Network / connection error';
        }
    }

    return {
        id: uuidv4(),
        Date: `${runDateStr} 01:00:00`,
        date: runDateStr,
        Page: context.pageName,
        page: context.pageName,
        segment: endpoint.segment,
        api: endpoint.path,
        status_code: statusCode,
        response_status: responseStatus,
        response_time_ms: responseTimeMs,
        error_message: errorMessage,
        run_id: runId,
        created_at: dayjs().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
    };
}

/**
 * Execute all tests for a registered page.
 * Idempotent: deletes any existing runs for today and page before writing new results.
 */
export async function runPageTests(pageName = 'Pricing Analysis') {
    if (isRunInProgress) {
        console.warn(`[ApiTestRunner] Execution skipped: another run is already in progress.`);
        return {
            success: false,
            message: 'A test run is already currently in progress. Please wait for it to complete.',
        };
    }

    isRunInProgress = true;
    const runId = uuidv4();
    const runDateStr = dayjs().tz(TIMEZONE).format('YYYY-MM-DD');

    console.log(`[ApiTestRunner] ========================================================`);
    console.log(`[ApiTestRunner] Starting Automated API Health Run for: "${pageName}"`);
    console.log(`[ApiTestRunner] Run ID: ${runId} | Date (IST): ${runDateStr}`);
    console.log(`[ApiTestRunner] ========================================================`);

    try {
        const pageConfig = getPageConfig(pageName);
        if (!pageConfig) {
            throw new Error(`Page "${pageName}" is not registered in apiLoggerRegistry.`);
        }

        const port = process.env.PORT || 5000;
        const baseUrl = process.env.API_LOGGER_BASE_URL || `http://localhost:${port}`;
        const targetDb = pageConfig.targetDb || process.env.API_LOGGER_TARGET_DB || process.env.CLICKHOUSE_DB || 'demo';

        const token = generateServiceToken(targetDb);
        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'x-db-name': targetDb,
            'x-current-date': runDateStr,
        };

        // 1. Resolve realistic dynamic context
        const context = await pageConfig.resolveContext(baseUrl, authHeaders);
        context.pageName = pageName;

        console.log(`[ApiTestRunner] Context resolved: Platform=${context.platform}, Category=${context.category}, DateRange=${context.startDate} to ${context.endDate}`);

        // 2. Run endpoint tests with concurrency pool
        const results = await asyncPool(
            CONCURRENCY_LIMIT,
            pageConfig.endpoints,
            (endpoint) => testEndpoint({
                endpoint,
                context,
                baseUrl,
                authHeaders,
                runId,
                runDateStr,
            })
        );

        // 3. Count summary statistics
        const successCount = results.filter(r => r.response_status === 'Success').length;
        const slowCount = results.filter(r => r.response_status === 'Slow').length;
        const failedCount = results.filter(r => r.response_status === 'Failed').length;

        console.log(`[ApiTestRunner] Test Execution Completed: Total=${results.length}, Success=${successCount}, Slow=${slowCount}, Failed=${failedCount}`);

        // 4. Idempotent deletion: remove any prior rows for (date, pageName)
        await deleteLogsForDateAndPage(runDateStr, pageName);

        // 5. Batch insert results into ClickHouse
        await insertLogs(results);

        // 6. Run backup cleanup for records older than 2 days
        await cleanupOldLogs();

        console.log(`[ApiTestRunner] Automated API Health Run finished successfully. Run ID: ${runId}`);

        return {
            success: true,
            runId,
            date: runDateStr,
            page: pageName,
            totalTested: results.length,
            successCount,
            slowCount,
            failedCount,
            results,
        };
    } catch (err) {
        console.error(`[ApiTestRunner] Failed during runPageTests for "${pageName}":`, err.message);
        return {
            success: false,
            runId,
            error: err.message,
        };
    } finally {
        isRunInProgress = false;
    }
}

/**
 * Check if a test run is currently executing.
 */
export function isTestRunActive() {
    return isRunInProgress;
}
