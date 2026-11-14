/**
 * API Logs Controller
 * Handles REST requests for fetching paginated API logs, summaries, filters,
 * and manually triggering test runs.
 */

import { 
    getLogs, 
    getSummary, 
    getFilterOptions,
    getDistribution
} from '../services/apiLoggerRepository.js';
import { 
    runPageTests, 
    isTestRunActive,
    getRunProgress,
    getAllActiveDatabases,
    getPermittedPagesForDb,
    setSuiteRunning,
    executeFullApiHealthCheck
} from '../services/apiTestRunner.js';
import { sendApiAlertReport, fetchAlertRecipients } from '../services/apiAlertReportService.js';
import { queryAdminDB, insertAdminDB, ADMIN_DB } from '../config/adminClickhouse.js';
import { getRegisteredPages } from '../config/apiLoggerRegistry.js';

/**
 * GET /api/api-logs
 * Fetch paginated API test logs with filtering, sorting, and search.
 */
export async function getApiLogs(req, res) {
    try {
        const {
            date,
            page,
            segment,
            status,
            emptyResponse,
            empty_response,
            clientDb,
            client_db,
            search,
            pageNumber,
            pageSize,
            sortBy,
            sortOrder,
        } = req.query;

        const result = await getLogs({
            date,
            page,
            segment,
            status,
            emptyResponse: emptyResponse ?? empty_response,
            clientDb: clientDb || client_db,
            search,
            pageNumber,
            pageSize,
            sortBy,
            sortOrder,
        });

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err) {
        console.error('[ApiLogsController] Error in getApiLogs:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve API logs',
            message: err.message,
        });
    }
}

/**
 * GET /api/api-logs/summary
 * Fetch summary metrics (Total, Success, Failed, Slow, Avg Response Time, Success Rate).
 */
export async function getApiLogsSummary(req, res) {
    try {
        const { date, page, clientDb, client_db } = req.query;

        const summary = await getSummary({ 
            date, 
            page, 
            clientDb: clientDb || client_db 
        });

        return res.status(200).json({
            success: true,
            data: summary,
            summary,
        });
    } catch (err) {
        console.error('[ApiLogsController] Error in getApiLogsSummary:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve API logs summary',
            message: err.message,
        });
    }
}

/**
 * GET /api/api-logs/filters
 * Fetch distinct dates, pages, and segments for UI dropdown filter bars.
 */
export async function getApiLogsFilters(req, res) {
    try {
        const filters = await getFilterOptions();
        const registered = getRegisteredPages();
        const mergedPages = Array.from(new Set([...registered, ...(filters.pages || [])]));
        filters.pages = mergedPages;

        return res.status(200).json({
            success: true,
            data: filters,
            filters,
        });
    } catch (err) {
        console.error('[ApiLogsController] Error in getApiLogsFilters:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve API log filter options',
            message: err.message,
        });
    }
}

/**
 * POST /api/api-logs/run
 * Manually trigger an API health test run in the background.
 * Returns immediately without blocking the request.
 */
export async function triggerApiLogsRun(req, res) {
    try {
        if (isTestRunActive()) {
            return res.status(409).json({
                success: false,
                error: 'Conflict',
                message: 'An API test run is already currently in progress. Please wait for it to complete.',
            });
        }

        const targetPage = req.body?.page || req.query?.page || 'All';
        const requestedClientDb = req.body?.clientDb || req.body?.client_db || req.query?.clientDb || req.query?.client_db || 'All';

        let targetDbs = [];
        if (requestedClientDb && requestedClientDb !== 'All') {
            targetDbs = [requestedClientDb];
        } else {
            targetDbs = await getAllActiveDatabases();
        }

        const pagesToTest = (!targetPage || targetPage === 'All' || targetPage === 'All Pages')
            ? getRegisteredPages()
            : [targetPage];

        // Trigger run in background using executeFullApiHealthCheck
        executeFullApiHealthCheck({ targetPage, requestedClientDb }).catch(runErr => {
            console.error('[ApiLogsController] Background multi-DB test run error:', runErr.message);
        });

        return res.status(202).json({
            success: true,
            status: 'started',
            databases: targetDbs,
            pagesCount: pagesToTest.length,
            message: `API health test run initiated for ${targetDbs.length} database(s) (${targetDbs.join(', ')}) across ${pagesToTest.length} page(s).`,
        });
    } catch (err) {
        console.error('[ApiLogsController] Error triggering test run:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to trigger API test run',
            message: err.message,
        });
    }
}

/**
 * GET /api/api-logs/status
 * Check whether a diagnostic test run is currently active and get progress.
 */
export async function getApiTestStatus(req, res) {
    try {
        const progress = getRunProgress();
        return res.status(200).json({
            success: true,
            ...progress,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
}


/**
 * GET /api/api-logs/distribution
 * Fetch 2-day health distribution (Success, Slow, Failed) and complete list of APIs per category for Pie Chart.
 */
export async function getApiLogsDistribution(req, res) {
    try {
        const { page, clientDb, client_db, days = 2 } = req.query;

        const result = await getDistribution({ 
            page, 
            clientDb: clientDb || client_db, 
            days 
        });

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err) {
        console.error('[ApiLogsController] Error in getApiLogsDistribution:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve API logs distribution',
            message: err.message,
        });
    }
}


/**
 * POST /api/api-logs/send-report
 * Manually trigger or test sending the API Alert Email Report.
 */
export async function sendApiAlertReportNow(req, res) {
    try {
        const { dateScope = 'today', dryRun = false } = req.body || {};
        console.log(`[ApiLogsController] Manual trigger for API Alert Report (dateScope=${dateScope}, dryRun=${dryRun})...`);
        const result = await sendApiAlertReport({ dateScope, dryRun: Boolean(dryRun) });
        return res.status(200).json({
            success: true,
            message: 'API Alert Report executed successfully',
            result,
        });
    } catch (err) {
        console.error('[ApiLogsController] Error in sendApiAlertReportNow:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to send API alert report',
            message: err.message,
        });
    }
}

/**
 * GET /api/api-logs/recipients
 * List all active recipient emails for the daily alert email.
 */
export async function getAlertRecipients(req, res) {
    try {
        const recipients = await fetchAlertRecipients();
        return res.status(200).json({
            success: true,
            data: recipients,
            recipients,
        });
    } catch (err) {
        console.error('[ApiLogsController] Error in getAlertRecipients:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch alert recipients',
            message: err.message,
        });
    }
}

/**
 * POST /api/api-logs/recipients
 * Add a new email recipient to admin_master.api_alert.
 */
export async function addAlertRecipient(req, res) {
    try {
        const { email } = req.body || {};
        const cleanEmail = (email || '').trim().toLowerCase();
        const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$/;

        if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email address provided',
            });
        }

        const existing = await queryAdminDB(`SELECT email FROM ${ADMIN_DB}.api_alert WHERE lower(email) = {email:String}`, { email: cleanEmail });
        if (existing.length > 0) {
            return res.status(200).json({
                success: true,
                message: 'Email is already a registered recipient',
                email: cleanEmail,
            });
        }

        await insertAdminDB('api_alert', [{ email: cleanEmail }]);
        console.log(`[ApiLogsController] Added new alert recipient: ${cleanEmail}`);

        const updated = await fetchAlertRecipients();
        return res.status(201).json({
            success: true,
            message: `Added recipient: ${cleanEmail}`,
            recipients: updated,
        });
    } catch (err) {
        console.error('[ApiLogsController] Error in addAlertRecipient:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to add recipient',
            message: err.message,
        });
    }
}

/**
 * DELETE /api/api-logs/recipients/:email
 * Remove an email recipient from admin_master.api_alert.
 */
export async function deleteAlertRecipient(req, res) {
    try {
        const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email parameter is required' });
        }

        await queryAdminDB(`ALTER TABLE ${ADMIN_DB}.api_alert DELETE WHERE lower(email) = '${email}'`);
        console.log(`[ApiLogsController] Removed alert recipient: ${email}`);

        const updated = await fetchAlertRecipients();
        return res.status(200).json({
            success: true,
            message: `Removed recipient: ${email}`,
            recipients: updated,
        });
    } catch (err) {
        console.error('[ApiLogsController] Error in deleteAlertRecipient:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to remove recipient',
            message: err.message,
        });
    }
}

