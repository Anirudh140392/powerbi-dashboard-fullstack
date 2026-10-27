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
    isTestRunActive 
} from '../services/apiTestRunner.js';
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

        const targetPage = req.body?.page || req.query?.page || '';
        const targetClientDb = req.body?.clientDb || req.body?.client_db || req.query?.clientDb || req.query?.client_db || '';

        // Trigger run in background
        (async () => {
            if (!targetPage || targetPage === 'All' || targetPage === 'All Pages') {
                const pages = getRegisteredPages();
                for (const p of pages) {
                    await runPageTests(p, targetClientDb);
                }
            } else {
                await runPageTests(targetPage, targetClientDb);
            }
        })().catch(runErr => {
            console.error('[ApiLogsController] Background test run error:', runErr.message);
        });

        return res.status(202).json({
            success: true,
            status: 'started',
            message: `API health test run initiated in background for "${targetPage || 'All Pages'}"${targetClientDb ? ` (Client: ${targetClientDb})` : ''}.`,
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
