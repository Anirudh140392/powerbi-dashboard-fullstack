/**
 * API Logs Controller
 * Handles REST requests for fetching paginated API logs, summaries, filters,
 * and manually triggering test runs.
 */

import { 
    getLogs, 
    getSummary, 
    getFilterOptions 
} from '../services/apiLoggerRepository.js';
import { 
    runPageTests, 
    isTestRunActive 
} from '../services/apiTestRunner.js';

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
        const { date, page } = req.query;

        const summary = await getSummary({ date, page });

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

        const targetPage = req.body?.page || req.query?.page || 'Pricing Analysis';

        // Trigger run in background
        runPageTests(targetPage).catch(runErr => {
            console.error('[ApiLogsController] Background test run error:', runErr.message);
        });

        return res.status(202).json({
            success: true,
            status: 'started',
            message: `API health test run initiated in background for "${targetPage}".`,
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
