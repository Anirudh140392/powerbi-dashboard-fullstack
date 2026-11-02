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
    getAllActiveDatabases,
    getPermittedPagesForDb,
    setSuiteRunning
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
        const requestedClientDb = req.body?.clientDb || req.body?.client_db || req.query?.clientDb || req.query?.client_db || '';

        // If a specific DB is requested (and not 'All'), test only that DB.
        // Otherwise (default when clicking Run Check), test one by one for ALL active databases present in tb_database table!
        let targetDbs = [];
        if (requestedClientDb && requestedClientDb !== 'All') {
            targetDbs = [requestedClientDb];
        } else {
            targetDbs = await getAllActiveDatabases();
        }

        const pagesToTest = (!targetPage || targetPage === 'All' || targetPage === 'All Pages')
            ? getRegisteredPages()
            : [targetPage];

        setSuiteRunning(true);

        // Trigger run in background sequentially for each database
        (async () => {
            console.log(`[ApiLogsController] Starting multi-DB test run across ${targetDbs.length} databases:`, targetDbs);
            try {
                for (const currentDb of targetDbs) {
                    const permittedPages = await getPermittedPagesForDb(currentDb);
                    const pagesForDb = (!targetPage || targetPage === 'All' || targetPage === 'All Pages')
                        ? permittedPages
                        : (permittedPages.includes(targetPage) ? [targetPage] : []);

                    if (pagesForDb.length === 0) {
                        console.log(`[ApiLogsController] No permitted pages to test for DB "${currentDb}" based on tab_permissions.`);
                        continue;
                    }

                    console.log(`[ApiLogsController] >>> Testing DB: "${currentDb}" (${pagesForDb.length} active pages: ${pagesForDb.join(', ')})...`);
                    for (const p of pagesForDb) {
                        try {
                            await runPageTests(p, currentDb);
                        } catch (pageErr) {
                            console.error(`[ApiLogsController] Error testing page "${p}" for DB "${currentDb}":`, pageErr.message);
                        }
                    }
                    console.log(`[ApiLogsController] <<< Finished testing DB: "${currentDb}"`);
                }
                console.log(`[ApiLogsController] Multi-database test run completed for all ${targetDbs.length} databases.`);
            } finally {
                setSuiteRunning(false);
            }
        })().catch(runErr => {
            setSuiteRunning(false);
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
        setSuiteRunning(false);
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
