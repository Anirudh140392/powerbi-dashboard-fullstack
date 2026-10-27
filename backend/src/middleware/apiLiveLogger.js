/**
 * Live API Request Logger Middleware
 * Automatically captures incoming user API requests and persists them
 * to admin_master.api_logs with client_db (e.g. 'boat', 'emami', 'mars'),
 * response latency, status codes, and empty response detection (0/1).
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { v4 as uuidv4 } from 'uuid';

import { isResponseEmpty } from '../services/apiTestRunner.js';
import { insertLogs } from '../services/apiLoggerRepository.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = process.env.API_LOGGER_TZ || 'Asia/Kolkata';
const SLOW_THRESHOLD_MS = parseInt(process.env.API_LOGGER_SLOW_THRESHOLD_MS || '5000', 10);

const ROUTE_PAGE_MAP = [
    { prefix: '/api/pricing-analysis', page: 'Pricing Analysis' },
    { prefix: '/api/control-tower', page: 'Control Tower' },
    { prefix: '/api/availability', page: 'Availability Analysis' },
    { prefix: '/api/visibility', page: 'Visibility Analysis' },
    { prefix: '/api/market-share', page: 'Market Share' },
    { prefix: '/api/portfolios', page: 'Portfolios Analysis' },
    { prefix: '/api/performance-marketing', page: 'Performance Marketing' },
    { prefix: '/api/content-analysis', page: 'Content Analysis' },
    { prefix: '/api/category-rca', page: 'Category RCA' },
    { prefix: '/api/ecom-rca', page: 'E-com RCA' },
    { prefix: '/api/sales', page: 'Sales' },
    { prefix: '/api/inventory-analysis', page: 'Inventory Analysis' },
    { prefix: '/api/reports', page: 'Reports' },
    { prefix: '/api/insights', page: 'Insights' },
    { prefix: '/api/primary-sales', page: 'Primary Sales' },
    { prefix: '/api/secondary-sales', page: 'Secondary Sales' },
    { prefix: '/api/mop-analysis', page: 'MOP Analysis' },
    { prefix: '/api/supply-chain', page: 'Supply Chain' },
    { prefix: '/api/walkthrough', page: 'Walkthrough' },
    { prefix: '/api/admin', page: 'Admin' },
];

/**
 * Resolve Page Name from request URL.
 */
function resolvePageFromUrl(url) {
    for (const mapping of ROUTE_PAGE_MAP) {
        if (url.startsWith(mapping.prefix)) {
            return mapping.page;
        }
    }
    // Fallback: extract second path segment
    const parts = url.split('/').filter(Boolean);
    if (parts.length >= 2) {
        return parts[1]
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    return 'General';
}

/**
 * Resolve Segment / Feature from request URL.
 */
function resolveSegmentFromUrl(url) {
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('/').filter(Boolean);
    if (parts.length >= 3) {
        const lastPart = parts[parts.length - 1];
        if (lastPart.toLowerCase() === 'kpis') return 'KPIs';
        if (lastPart.toLowerCase() === 'skus') return 'SKUs';
        if (lastPart.toLowerCase() === 'rca') return 'RCA';
        return lastPart
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    return 'Summary';
}

// In-memory non-blocking batch queue
const logQueue = [];
let flushTimer = null;

async function flushQueue() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (logQueue.length === 0) return;

    const itemsToInsert = logQueue.splice(0, logQueue.length);
    try {
        await insertLogs(itemsToInsert);
    } catch (err) {
        console.warn('[LiveApiLogger] Failed to flush live logs batch:', err.message);
    }
}

function queueLog(entry) {
    logQueue.push(entry);
    if (logQueue.length >= 25) {
        flushQueue();
    } else if (!flushTimer) {
        flushTimer = setTimeout(flushQueue, 2000);
    }
}

/**
 * Express Middleware for live API request logging.
 */
export function apiLiveLoggerMiddleware(req, res, next) {
    // 1. Skip preflights and non-API requests
    if (req.method === 'OPTIONS') return next();

    const originalUrl = req.originalUrl || req.url || '';
    const cleanPath = originalUrl.split('?')[0];

    // 2. Ignore internal telemetry, test runner calls, and log inspection endpoints
    if (
        req.headers['x-automated-test-runner'] === 'true' ||
        cleanPath.startsWith('/api/api-logs') ||
        cleanPath.startsWith('/api/visitors') ||
        cleanPath.startsWith('/api/whatsapp') ||
        cleanPath === '/health' ||
        cleanPath === '/favicon.ico'
    ) {
        return next();
    }

    const startTime = Date.now();
    let capturedBody = null;

    // Intercept res.send and res.json to capture response body for empty_response calculation
    const originalSend = res.send;
    res.send = function (body) {
        capturedBody = body;
        return originalSend.apply(this, arguments);
    };

    const originalJson = res.json;
    res.json = function (jsonBody) {
        capturedBody = jsonBody;
        return originalJson.apply(this, arguments);
    };

    // On request completion
    res.on('finish', () => {
        try {
            const durationMs = Date.now() - startTime;
            const statusCode = res.statusCode || 200;

            // Resolve client database from user session or headers
            const clientDb = (
                req.user?.dbName ||
                req.headers['x-db-name'] ||
                req.headers['x-database'] ||
                req.query?.db ||
                req.query?.dbName ||
                'demo'
            );

            // Parse response body to calculate empty_response (0 or 1)
            let parsedData = capturedBody;
            if (typeof capturedBody === 'string') {
                try {
                    parsedData = JSON.parse(capturedBody);
                } catch {
                    // Raw string
                }
            }

            const emptyResponse = isResponseEmpty(parsedData);

            // Determine response status
            const isHttpSuccess = statusCode >= 200 && statusCode < 300;
            const isBodySuccess = parsedData?.success !== false;

            let responseStatus = 'Failed';
            let errorMessage = '';

            if (isHttpSuccess && isBodySuccess) {
                if (durationMs > SLOW_THRESHOLD_MS) {
                    responseStatus = 'Slow';
                } else {
                    responseStatus = 'Success';
                }
            } else {
                responseStatus = 'Failed';
                if (!isHttpSuccess) {
                    errorMessage = `HTTP ${statusCode}: ${res.statusMessage || 'Error response'}`;
                } else if (!isBodySuccess) {
                    errorMessage = parsedData?.error || parsedData?.message || 'Response body flagged success=false';
                }
            }

            const now = dayjs().tz(TIMEZONE);
            const dateStr = now.format('YYYY-MM-DD');

            const logEntry = {
                id: uuidv4(),
                Date: `${dateStr} ${now.format('HH:mm:ss')}`,
                date: dateStr,
                Page: resolvePageFromUrl(cleanPath),
                page: resolvePageFromUrl(cleanPath),
                segment: resolveSegmentFromUrl(cleanPath),
                api: cleanPath,
                status_code: statusCode,
                response_status: responseStatus,
                response_time_ms: durationMs,
                empty_response: emptyResponse,
                client_db: String(clientDb).toLowerCase(),
                error_message: errorMessage,
                run_id: 'live_user_traffic',
                created_at: now.format('YYYY-MM-DD HH:mm:ss'),
            };

            queueLog(logEntry);
        } catch (err) {
            console.warn('[LiveApiLogger] Error recording log entry:', err.message);
        }
    });

    next();
}

export default apiLiveLoggerMiddleware;
