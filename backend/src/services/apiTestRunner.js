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

import { getPageConfig, getRegisteredPages } from '../config/apiLoggerRegistry.js';
import { 
    deleteLogsForDateAndPage, 
    insertLogs, 
    cleanupOldLogs 
} from './apiLoggerRepository.js';
import { queryAdminDB, ADMIN_DB } from '../config/adminClickhouse.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';
const SLOW_THRESHOLD_MS = parseInt(process.env.API_LOGGER_SLOW_THRESHOLD_MS || '5000', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.API_LOGGER_TIMEOUT_MS || '30000', 10);
const TIMEZONE = process.env.API_LOGGER_TZ || 'Asia/Kolkata';
const CONCURRENCY_LIMIT = 3;

// Lock flags to prevent overlapping runs
let isRunInProgress = false;
let isSuiteRunning = false;

export function setSuiteRunning(val) {
    isSuiteRunning = Boolean(val);
    runProgress.isRunning = isSuiteRunning || isRunInProgress;
}

let runProgress = {
    isRunning: false,
    currentDb: null,
    completedDbs: [],
    totalDbs: 0,
    startTime: null,
};

export function getRunProgress() {
    return {
        ...runProgress,
        isRunning: isTestRunActive(),
    };
}


let cachedDefaultClientDb = null;
/**
 * Dynamically resolves all active client databases from tb_database table.
 * Enables executing tests one by one across all databases.
 */
export async function getAllActiveDatabases() {
    try {
        const rows = await queryAdminDB(`
            SELECT DISTINCT db_name 
            FROM ${ADMIN_DB}.tb_database 
            WHERE status = 'active' 
            ORDER BY db_name ASC
        `);
        const dbs = rows.map(r => r.db_name).filter(Boolean);
        if (dbs.length > 0) return dbs;
    } catch (e) {
        console.warn('[ApiTestRunner] Failed to query active databases from tb_database:', e.message);
    }
    return [process.env.CLICKHOUSE_DB || 'marico'];
}

/**
 * Dynamically resolves the active client database for the currently connected ClickHouse server.
 * Ensures tests run against valid local databases rather than hardcoded foreign databases.
 */
export async function resolveDefaultClientDb() {
    if (process.env.API_LOGGER_TARGET_DB) {
        return process.env.API_LOGGER_TARGET_DB;
    }
    if (cachedDefaultClientDb) return cachedDefaultClientDb;
    try {
        const dbs = await getAllActiveDatabases();
        if (dbs.length > 0) {
            cachedDefaultClientDb = dbs[0];
            return cachedDefaultClientDb;
        }
    } catch (e) {
        console.warn('[ApiTestRunner] Failed to query active client DB from tb_database:', e.message);
    }
    cachedDefaultClientDb = process.env.CLICKHOUSE_DB || 'demo';
    return cachedDefaultClientDb;
}

/**
 * Helper to check whether a specific page is permitted by tab_permissions object.
 */
export function isPagePermitted(perms, pageName) {
    if (!perms || typeof perms !== 'object') return true;

    // Check direct tab name
    if (perms[pageName] === false) return false;
    if (perms[pageName] === true) return true;

    // Check known aliases
    if (pageName === 'Primary Summary' || pageName === 'Secondary Summary') {
        if (perms['Sales Data'] === false) return false;
        if (perms['Sales Data'] === true) return true;
    }
    if (pageName === 'Content Analysis') {
        if (perms['Content Score'] === false) return false;
        if (perms['Content Score'] === true) return true;
    }
    if (pageName === 'Business Overview') {
        if (perms['Watch Tower'] === false) return false;
    }
    if (pageName === 'India Overview') {
        if (perms['Geo Intelligence'] === false) return false;
    }

    return true;
}

/**
 * Resolves permitted pages for a given client database by reading tab_permissions from tb_user.
 * If tab_permissions marks a page as false (e.g. Sales Data: false, Download Report: false),
 * that page is excluded from the test execution for that database.
 */
export async function getPermittedPagesForDb(targetDb) {
    const allPages = getRegisteredPages();
    if (!targetDb) return allPages;

    try {
        const rows = await queryAdminDB(`
            SELECT u.tab_permissions
            FROM ${ADMIN_DB}.tb_user u
            JOIN ${ADMIN_DB}.tb_database d ON u.db_id = d.db_id
            WHERE (d.db_name = '${targetDb.replace(/'/g, "''")}' OR d.mapped_db LIKE '%${targetDb.replace(/'/g, "''")}%')
              AND u.tab_permissions IS NOT NULL 
              AND u.tab_permissions != ''
            LIMIT 1
        `);

        if (!rows || rows.length === 0 || !rows[0].tab_permissions) {
            return allPages;
        }

        let perms = {};
        try {
            perms = JSON.parse(rows[0].tab_permissions);
        } catch (e) {
            return allPages;
        }

        return allPages.filter(pageName => isPagePermitted(perms, pageName));
    } catch (err) {
        console.warn(`[ApiTestRunner] Error checking tab_permissions for DB "${targetDb}":`, err.message);
        return allPages;
    }
}

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
 * Check whether an API response payload is empty (returns 1) or has non-empty data (returns 0).
 * Even if status code is 200, if response data has no records/items, empty_response will be 1.
 */
export function isResponseEmpty(data) {
    if (data === null || data === undefined) return 1;

    // String check
    if (typeof data === 'string') {
        const trimmed = data.trim();
        if (!trimmed || trimmed === '[]' || trimmed === '{}' || trimmed === 'null') return 1;
        try {
            const parsed = JSON.parse(trimmed);
            return isResponseEmpty(parsed);
        } catch {
            return 0; // Has text body
        }
    }

    // Number or boolean body
    if (typeof data === 'number' || typeof data === 'boolean') {
        return 0;
    }

    // Array check
    if (Array.isArray(data)) {
        return data.length === 0 ? 1 : 0;
    }

    // Object check
    if (typeof data === 'object') {
        const keys = Object.keys(data);
        if (keys.length === 0) return 1;

        // Common wrapper keys containing data payload
        const payloadCandidates = [
            'data', 'rows', 'results', 'items', 'records', 'list',
            'platforms', 'categories', 'brands', 'skus', 'cities',
            'overview', 'table', 'chart', 'kpis', 'metrics', 'trends'
        ];

        // Check if any payload candidate exists
        for (const key of payloadCandidates) {
            if (key in data) {
                const val = data[key];
                if (val === null || val === undefined) return 1;
                if (Array.isArray(val)) return val.length === 0 ? 1 : 0;
                if (typeof val === 'object') return Object.keys(val).length === 0 ? 1 : 0;
                if (typeof val === 'string') return val.trim().length === 0 ? 1 : 0;
                if (typeof val === 'number' || typeof val === 'boolean') return 0;
            }
        }

        // If no candidate key matched, filter out generic metadata/status keys
        const metadataKeys = new Set([
            'success', 'status', 'statusCode', 'code', 'message', 'msg',
            'error', 'timestamp', 'time', 'cached', 'duration', 'page', 'pageSize', 'totalPages'
        ]);
        const contentKeys = keys.filter(k => !metadataKeys.has(k));

        // If the object only contained metadata keys like { success: true } or { success: true, message: 'OK' }
        if (contentKeys.length === 0) {
            if ('total' in data && (data.total === 0 || data.total === '0')) return 1;
            return 1;
        }

        // Check if any content key has non-empty value
        const hasActualContent = contentKeys.some(k => {
            const val = data[k];
            if (val === null || val === undefined) return false;
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === 'object') return Object.keys(val).length > 0;
            if (typeof val === 'string') return val.trim().length > 0;
            if (typeof val === 'number' || typeof val === 'boolean') return true;
            return false;
        });

        return hasActualContent ? 0 : 1;
    }

    return 0;
}

/**
 * Test a single endpoint and record results.
 */
async function testEndpoint({ endpoint, context, baseUrl, authHeaders, runId, runDateStr, targetDb }) {
    const fullUrl = `${baseUrl}${endpoint.path}`;
    const params = endpoint.buildParams ? endpoint.buildParams(context) : {};

    console.log(`[ApiTestRunner] Testing: [${endpoint.method}] ${endpoint.path} (Segment: ${endpoint.segment}, Client: ${targetDb || 'demo'})`);

    const startTime = Date.now();
    let statusCode = 0;
    let responseStatus = 'Failed';
    let errorMessage = '';
    let responseTimeMs = 0;
    let emptyResponse = 1; // Default to empty

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

        // Check whether API response payload is empty (1) or non-empty (0)
        emptyResponse = isResponseEmpty(response.data);

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
        emptyResponse = 1;

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
        empty_response: emptyResponse,
        client_db: String(targetDb || context.targetDb || process.env.CLICKHOUSE_DB || ''),
        error_message: errorMessage,
        run_id: runId,
        created_at: dayjs().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
    };
}

/**
 * Execute all tests for a registered page.
 * Idempotent: deletes any existing runs for today, page, and targetDb before writing new results.
 */
export async function runPageTests(pageName = 'Pricing Analysis', clientDb = '') {
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

const PAGE_REQUIRED_TABLES = {
    'Primary Summary': 'rb_primary_olap',
    'Secondary Summary': 'rb_secondary_olap',
    'Content Analysis': 'rb_product_verify',
    'Download Report': 'rb_pdp',
};

        let targetDb = clientDb || process.env.API_LOGGER_TARGET_DB || pageConfig.targetDb;
        // Guard against empty array being truthy (would otherwise skip fallback)
        if (Array.isArray(targetDb) && targetDb.length === 0) {
            targetDb = process.env.API_LOGGER_TARGET_DB || pageConfig.targetDb || '';
        }
        if (!targetDb) {
            targetDb = await resolveDefaultClientDb();
        }

        // 1. Skip page if disabled in tab_permissions for this client database
        const permittedPages = await getPermittedPagesForDb(targetDb);
        if (!permittedPages.includes(pageName)) {
            console.log(`[ApiTestRunner] Skipping page "${pageName}" for DB "${targetDb}": disabled in tab_permissions.`);
            return {
                success: true,
                skipped: true,
                runId,
                date: runDateStr,
                page: pageName,
                clientDb: targetDb,
                totalTested: 0,
                successCount: 0,
                slowCount: 0,
                failedCount: 0,
                results: [],
            };
        }

        // Skip pages if the required table does not exist in the target database
        if (PAGE_REQUIRED_TABLES[pageName]) {
            const tableNeeded = PAGE_REQUIRED_TABLES[pageName];
            try {
                const tableCheck = await queryAdminDB(
                    `SELECT count() as cnt FROM system.tables WHERE database = '${targetDb}' AND name = '${tableNeeded}'`
                );
                if (Number(tableCheck[0]?.cnt || 0) === 0) {
                    console.log(`[ApiTestRunner] Skipping page "${pageName}" for DB "${targetDb}": required table "${tableNeeded}" does not exist.`);
                    return {
                        success: true,
                        skipped: true,
                        runId,
                        date: runDateStr,
                        page: pageName,
                        clientDb: targetDb,
                        totalTested: 0,
                        successCount: 0,
                        slowCount: 0,
                        failedCount: 0,
                        results: [],
                    };
                }
            } catch (tableErr) {
                // proceed if system.tables is inaccessible
            }
        }

        const baseUrl = process.env.API_LOGGER_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5000}`;

        const token = generateServiceToken(targetDb);
        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'x-db-name': targetDb,
            'x-current-date': runDateStr,
            'x-automated-test-runner': 'true',
        };

        // 1. Resolve realistic dynamic context
        const context = await pageConfig.resolveContext(baseUrl, authHeaders);
        context.pageName = pageName;
        context.targetDb = targetDb;

        console.log(`[ApiTestRunner] Context resolved: Client=${targetDb}, Platform=${context.platform}, Category=${context.category}, DateRange=${context.startDate} to ${context.endDate}`);

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
                targetDb,
            })
        );

        // 3. Count summary statistics
        const successCount = results.filter(r => r.response_status === 'Success').length;
        const slowCount = results.filter(r => r.response_status === 'Slow').length;
        const failedCount = results.filter(r => r.response_status === 'Failed').length;

        console.log(`[ApiTestRunner] Test Execution Completed: Total=${results.length}, Success=${successCount}, Slow=${slowCount}, Failed=${failedCount}`);

        // 4. Idempotent deletion: remove any prior rows for (date, pageName, targetDb)
        await deleteLogsForDateAndPage(runDateStr, pageName, targetDb);

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
            clientDb: targetDb,
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
    return isRunInProgress || isSuiteRunning;
}

/**
 * Execute a complete automated health check suite across multiple databases and pages.
 * Used by both the 09:00 AM automated scheduler and the manual UI run trigger.
 */
export async function executeFullApiHealthCheck({ targetPage = 'All', requestedClientDb = 'All' } = {}) {
    if (isTestRunActive()) {
        console.warn('[ApiTestRunner] A test run is already currently in progress. Skipping duplicate execution.');
        return { success: false, inProgress: true, message: 'Test run is already in progress' };
    }

    setSuiteRunning(true);

    let targetDbs = [];
    try {
        // Normalize requestedClientDb: empty array => 'All' (no specific client)
        const clientDbVal = Array.isArray(requestedClientDb)
            ? (requestedClientDb.length > 0 ? requestedClientDb : 'All')
            : requestedClientDb;

        if (clientDbVal && clientDbVal !== 'All') {
            targetDbs = Array.isArray(clientDbVal) ? clientDbVal : [String(clientDbVal)];
        } else {
            targetDbs = await getAllActiveDatabases();
        }
    } catch (e) {
        console.warn('[ApiTestRunner] Error resolving target databases, falling back to default:', e.message);
        targetDbs = [process.env.CLICKHOUSE_DB || 'marico'];
    }

    const registeredPages = getRegisteredPages();
    const pagesToTest = (!targetPage || targetPage === 'All' || targetPage === 'All Pages')
        ? registeredPages
        : [targetPage];

    runProgress = {
        isRunning: true,
        currentDb: null,
        completedDbs: [],
        totalDbs: targetDbs.length,
        startTime: new Date().toISOString(),
    };

    console.log(`[ApiTestRunner] 🚀 Starting full API health check across ${targetDbs.length} database(s) (${targetDbs.join(', ')}) at ${new Date().toISOString()}...`);

    const summary = {
        totalDbs: targetDbs.length,
        databasesTested: [],
        totalTested: 0,
        successCount: 0,
        slowCount: 0,
        failedCount: 0,
    };

    try {
        // Run cleanup of old/expired logs before executing health checks
        try {
            await cleanupOldLogs();
        } catch (cleanErr) {
            console.warn('[ApiTestRunner] Pre-run cleanup notice:', cleanErr.message);
        }

        for (const currentDb of targetDbs) {
            runProgress.currentDb = currentDb;
            let permittedPages = [];
            try {
                permittedPages = await getPermittedPagesForDb(currentDb);
            } catch (permErr) {
                console.warn(`[ApiTestRunner] Could not fetch permissions for "${currentDb}", testing all registered pages:`, permErr.message);
                permittedPages = registeredPages;
            }

            const pagesForDb = (!targetPage || targetPage === 'All' || targetPage === 'All Pages')
                ? permittedPages
                : (permittedPages.includes(targetPage) ? [targetPage] : []);

            if (pagesForDb.length === 0) {
                console.log(`[ApiTestRunner] No permitted pages to test for DB "${currentDb}" based on tab_permissions.`);
                continue;
            }

            console.log(`[ApiTestRunner] >>> Testing DB: "${currentDb}" (${pagesForDb.length} active pages: ${pagesForDb.join(', ')})...\n`);
            for (const p of pagesForDb) {
                try {
                    const pageResult = await runPageTests(p, currentDb);
                    if (pageResult && pageResult.success) {
                        summary.totalTested += pageResult.totalTested || 0;
                        summary.successCount += pageResult.successCount || 0;
                        summary.slowCount += pageResult.slowCount || 0;
                        summary.failedCount += pageResult.failedCount || 0;
                    }
                } catch (pageErr) {
                    console.error(`[ApiTestRunner] Error testing page "${p}" for DB "${currentDb}":`, pageErr.message);
                }
            }
            summary.databasesTested.push(currentDb);
            runProgress.completedDbs.push(currentDb);
            console.log(`[ApiTestRunner] <<< Finished testing DB: "${currentDb}"`);
        }

        console.log(`[ApiTestRunner] ✅ Full API health check completed. Tested ${summary.totalTested} endpoints across ${summary.databasesTested.length} databases.`);
        return { success: true, ...summary };
    } catch (err) {
        console.error('[ApiTestRunner] Error executing full API health check:', err.message);
        return { success: false, error: err.message };
    } finally {
        runProgress = {
            isRunning: false,
            currentDb: null,
            completedDbs: [],
            totalDbs: 0,
            startTime: null,
        };
        setSuiteRunning(false);
    }
}

