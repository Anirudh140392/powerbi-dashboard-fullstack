/**
 * API Logs Service
 * Frontend HTTP client layer for interacting with backend /api/api-logs endpoints.
 */

import axiosInstance from './axiosInstance';

/**
 * Format query params for Axios GET requests.
 * Serializes array clientDb into comma-separated values to avoid bracket notation (clientDb[]=...).
 */
function formatParams(params = {}) {
    const formatted = { ...params };
    if (Array.isArray(formatted.clientDb)) {
        if (formatted.clientDb.length > 0) {
            formatted.clientDb = formatted.clientDb.join(',');
        } else {
            delete formatted.clientDb;
        }
    }
    return formatted;
}

/**
 * Fetch paginated API logs with search, filter, and sorting.
 */
export async function fetchApiLogs(params = {}) {
    const response = await axiosInstance.get('/api-logs', { params: formatParams(params) });
    return response.data;
}

/**
 * Fetch summary metrics (Total, Success, Slow, Failed, Avg Latency, Success Rate).
 */
export async function fetchApiLogsSummary(params = {}) {
    const response = await axiosInstance.get('/api-logs/summary', { params: formatParams(params) });
    return response.data;
}

/**
 * Fetch filter options (available dates, pages, segments).
 */
export async function fetchApiLogsFilters() {
    const response = await axiosInstance.get('/api-logs/filters');
    return response.data;
}

/**
 * Fetch 2-day health distribution (Success, Slow, Failed) and complete API lists for Pie Chart.
 */
export async function fetchApiLogsDistribution(params = {}) {
    const response = await axiosInstance.get('/api-logs/distribution', { params: formatParams(params) });
    return response.data;
}

/**
 * Trigger an immediate manual test run for a page and optional client database.
 */
export async function triggerApiTestRun(page = 'All', clientDb = '') {
    const payload = typeof page === 'object' ? page : { page, clientDb };
    const response = await axiosInstance.post('/api-logs/run', payload);
    return response.data;
}

/**
 * Fetch current diagnostic test run status and progress.
 */
export async function fetchApiTestStatus() {
    const response = await axiosInstance.get('/api-logs/status');
    return response.data;
}
