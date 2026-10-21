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
 * Trigger an immediate manual test run for a page.
 */
export async function triggerApiTestRun(page = 'Pricing Analysis') {
    const response = await axiosInstance.post('/api-logs/run', { page });
    return response.data;
}
