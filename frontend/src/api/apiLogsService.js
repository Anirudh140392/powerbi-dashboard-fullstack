/**
 * API Logs Service
 * Frontend HTTP client layer for interacting with backend /api/api-logs endpoints.
 */

import axiosInstance from './axiosInstance';

/**
 * Fetch paginated API logs with search, filter, and sorting.
 */
export async function fetchApiLogs(params = {}) {
    const response = await axiosInstance.get('/api-logs', { params });
    return response.data;
}

/**
 * Fetch summary metrics (Total, Success, Slow, Failed, Avg Latency, Success Rate).
 */
export async function fetchApiLogsSummary(params = {}) {
    const response = await axiosInstance.get('/api-logs/summary', { params });
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
    const response = await axiosInstance.get('/api-logs/distribution', { params });
    return response.data;
}

/**
 * Trigger an immediate manual test run for a page and optional client database.
 */
export async function triggerApiTestRun(page = 'Pricing Analysis', clientDb = '') {
    const payload = typeof page === 'object' ? page : { page, clientDb };
    const response = await axiosInstance.post('/api-logs/run', payload);
    return response.data;
}
