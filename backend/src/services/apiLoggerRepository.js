/**
 * API Logger Repository
 * Encapsulates all ClickHouse persistence and retrieval for admin_master.api_logs.
 */

import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { queryAdminDB, insertAdminDB } from '../config/adminClickhouse.js';

const RETENTION_DAYS = parseInt(process.env.API_LOGGER_RETENTION_DAYS || '2', 10);

/**
 * Whitelist of safe columns for dynamic ORDER BY sorting to prevent SQL injection.
 */
const ALLOWED_SORT_COLUMNS = {
    'date': 'Date',
    'Date': 'Date',
    'page': 'Page',
    'Page': 'Page',
    'segment': 'segment',
    'api': 'api',
    'status_code': 'status_code',
    'response_status': 'response_status',
    'response_time_ms': 'response_time_ms',
    'created_at': 'created_at',
};

/**
 * Ensure table schema, missing columns, and 2-day TTL exist in admin_master.
 */
export async function ensureApiLogsSchema() {
    try {
        // 1. Create table if it doesn't already exist
        await queryAdminDB(`
            CREATE TABLE IF NOT EXISTS admin_master.api_logs (
                id UUID DEFAULT generateUUIDv4(),
                Date DateTime DEFAULT now(),
                Page Nullable(String),
                segment Nullable(String),
                api Nullable(String),
                status_code Nullable(UInt16),
                response_status Nullable(String),
                response_time_ms UInt32 DEFAULT 0,
                error_message String DEFAULT '',
                run_id String DEFAULT '',
                created_at DateTime DEFAULT now()
            )
            ENGINE = MergeTree
            ORDER BY (Date)
            TTL toDate(Date) + toIntervalDay(2)
            SETTINGS index_granularity = 8192
        `);

        // 2. Ensure extra columns exist if the table was created previously without them
        const columnsToAdd = [
            { name: 'response_time_ms', type: 'UInt32 DEFAULT 0' },
            { name: 'error_message', type: "String DEFAULT ''" },
            { name: 'run_id', type: "String DEFAULT ''" },
            { name: 'created_at', type: 'DateTime DEFAULT now()' },
            { name: 'id', type: 'UUID DEFAULT generateUUIDv4()' },
        ];

        for (const col of columnsToAdd) {
            await queryAdminDB(`
                ALTER TABLE admin_master.api_logs 
                ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
            `).catch(() => {});
        }

        // 3. Ensure TTL is configured
        await queryAdminDB(`
            ALTER TABLE admin_master.api_logs 
            MODIFY TTL toDate(Date) + toIntervalDay(${RETENTION_DAYS})
        `).catch(() => {});

        console.log('[ApiLoggerRepo] Schema and TTL verified for admin_master.api_logs');
    } catch (err) {
        console.error('[ApiLoggerRepo] Failed during ensureApiLogsSchema:', err.message);
        throw err;
    }
}

/**
 * Backup explicit cleanup: Delete logs older than retention days (default 2 days: keeps today and yesterday).
 */
export async function cleanupOldLogs(retentionDays = RETENTION_DAYS) {
    try {
        const daysBack = Math.max(1, retentionDays - 1);
        console.log(`[ApiLoggerRepo] Running explicit cleanup (removing data older than today - ${daysBack} days)...`);
        
        await queryAdminDB(
            `ALTER TABLE admin_master.api_logs DELETE WHERE toDate(Date) < today() - ${daysBack}`
        );
        console.log('[ApiLoggerRepo] Cleanup completed successfully');
        return { success: true };
    } catch (err) {
        console.error('[ApiLoggerRepo] Cleanup failed:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Idempotent run support: deletes any existing rows for the given run date and page
 * before inserting new run results.
 */
export async function deleteLogsForDateAndPage(dateStr, pageName) {
    try {
        console.log(`[ApiLoggerRepo] Idempotent delete: checking existing records for date=${dateStr}, page=${pageName}...`);
        await queryAdminDB(
            `ALTER TABLE admin_master.api_logs DELETE WHERE toDate(Date) = toDate({targetDate:String}) AND Page = {pageName:String}`,
            { targetDate: dateStr, pageName }
        );
        return { success: true };
    } catch (err) {
        console.error(`[ApiLoggerRepo] Failed to delete existing records for ${pageName} on ${dateStr}:`, err.message);
        throw err;
    }
}

/**
 * Batch insert run results into ClickHouse.
 */
export async function insertLogs(rows) {
    if (!rows || rows.length === 0) return { success: true, inserted: 0 };

    try {
        const formattedRows = rows.map(r => ({
            id: r.id || uuidv4(),
            Date: r.Date || `${r.date} 01:00:00`,
            Page: r.Page || r.page,
            segment: r.segment,
            api: r.api,
            status_code: Number(r.status_code || r.statusCode) || 0,
            response_status: r.response_status || r.responseStatus,
            response_time_ms: Number(r.response_time_ms || r.responseTimeMs) || 0,
            error_message: String(r.error_message || r.errorMessage || ''),
            run_id: String(r.run_id || r.runId || ''),
            created_at: r.created_at || dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }));

        console.log(`[ApiLoggerRepo] Batch inserting ${formattedRows.length} logs into admin_master.api_logs`);
        await insertAdminDB('api_logs', formattedRows);
        return { success: true, inserted: formattedRows.length };
    } catch (err) {
        console.error('[ApiLoggerRepo] Batch insert failed:', err.message);
        throw err;
    }
}

/**
 * Fetch paginated logs with search, filtering, and sorting.
 * Always restricts results to toDate(Date) >= today() - (RETENTION_DAYS - 1).
 */
export async function getLogs({
    date = '',
    page = '',
    segment = '',
    status = '',
    search = '',
    pageNumber = 1,
    pageSize = 20,
    sortBy = 'Date',
    sortOrder = 'DESC',
} = {}) {
    const pageNum = Math.max(1, parseInt(pageNumber, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
    const offset = (pageNum - 1) * limit;

    const safeSortCol = ALLOWED_SORT_COLUMNS[sortBy] || 'Date';
    const safeSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Base retention window constraint (never show data older than retention window)
    const daysBack = Math.max(1, RETENTION_DAYS - 1);
    const whereClauses = [`toDate(Date) >= today() - ${daysBack}`];
    const params = {};

    if (date) {
        whereClauses.push('toDate(Date) = toDate({targetDate:String})');
        params.targetDate = date;
    }

    if (page) {
        whereClauses.push('Page = {targetPage:String}');
        params.targetPage = page;
    }

    if (segment && segment !== 'All') {
        whereClauses.push('segment = {targetSegment:String}');
        params.targetSegment = segment;
    }

    if (status && status !== 'All') {
        whereClauses.push('response_status = {targetStatus:String}');
        params.targetStatus = status;
    }

    if (search && search.trim()) {
        whereClauses.push('positionCaseInsensitive(api, {searchTerm:String}) > 0');
        params.searchTerm = search.trim();
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 1. Fetch total count
    const countSql = `SELECT count() as total FROM admin_master.api_logs ${whereSql}`;
    const countRows = await queryAdminDB(countSql, params);
    const total = Number(countRows[0]?.total || 0);

    // 2. Fetch paginated data
    const querySql = `
        SELECT 
            toString(id) as id,
            toString(toDate(Date)) as date,
            Date as timestamp,
            Page as page,
            segment,
            api,
            status_code,
            response_status,
            response_time_ms,
            error_message,
            run_id,
            created_at
        FROM admin_master.api_logs
        ${whereSql}
        ORDER BY ${safeSortCol} ${safeSortOrder}, id ASC
        LIMIT ${limit} OFFSET ${offset}
    `;

    const rawRows = await queryAdminDB(querySql, params);

    const rows = rawRows.map(r => ({
        id: r.id,
        date: r.date,
        timestamp: r.timestamp,
        page: r.page,
        segment: r.segment,
        api: r.api,
        statusCode: Number(r.status_code) || 0,
        responseStatus: r.response_status || 'Unknown',
        responseTimeMs: Number(r.response_time_ms) || 0,
        errorMessage: r.error_message || '',
        runId: r.run_id || '',
        createdAt: r.created_at,
    }));

    return {
        data: rows,
        total,
        pageNumber: pageNum,
        pageSize: limit,
        totalPages: Math.ceil(total / limit) || 1,
    };
}

/**
 * Fetch summary metrics for a given date or latest run date.
 */
export async function getSummary({ date = '', page = '' } = {}) {
    const daysBack = Math.max(1, RETENTION_DAYS - 1);
    const whereClauses = [`toDate(Date) >= today() - ${daysBack}`];
    const params = {};

    if (date) {
        whereClauses.push('toDate(Date) = toDate({targetDate:String})');
        params.targetDate = date;
    }

    if (page) {
        whereClauses.push('Page = {targetPage:String}');
        params.targetPage = page;
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
        SELECT 
            count() as total_apis,
            countIf(response_status = 'Success') as success_count,
            countIf(response_status = 'Failed') as failed_count,
            countIf(response_status = 'Slow') as slow_count,
            round(avg(response_time_ms), 1) as avg_latency_ms,
            max(created_at) as last_run_at,
            toString(max(toDate(Date))) as latest_date
        FROM admin_master.api_logs
        ${whereSql}
    `;

    const rows = await queryAdminDB(sql, params);
    const row = rows[0] || {};

    const totalApis = Number(row.total_apis) || 0;
    const successCount = Number(row.success_count) || 0;
    const failedCount = Number(row.failed_count) || 0;
    const slowCount = Number(row.slow_count) || 0;
    const avgResponseTimeMs = Number(row.avg_latency_ms) || 0;
    const lastRunAt = row.last_run_at || null;
    const latestDate = row.latest_date || null;

    const successRate = totalApis > 0 
        ? Math.round(((successCount) / totalApis) * 1000) / 10 
        : 0;

    return {
        totalApis,
        successCount,
        failedCount,
        slowCount,
        successRate,
        avgResponseTimeMs,
        lastRunAt,
        latestDate,
    };
}

/**
 * Fetch distinct filter values (available dates, pages, segments) for UI dropdowns.
 */
export async function getFilterOptions() {
    const daysBack = Math.max(1, RETENTION_DAYS - 1);

    const [datesRows, pagesRows, segmentsRows] = await Promise.all([
        queryAdminDB(`
            SELECT DISTINCT toString(toDate(Date)) as date 
            FROM admin_master.api_logs 
            WHERE toDate(Date) >= today() - ${daysBack}
            ORDER BY date DESC
        `),
        queryAdminDB(`
            SELECT DISTINCT Page as page 
            FROM admin_master.api_logs 
            WHERE Page IS NOT NULL AND Page != ''
            ORDER BY page ASC
        `),
        queryAdminDB(`
            SELECT DISTINCT segment 
            FROM admin_master.api_logs 
            WHERE segment IS NOT NULL AND segment != ''
            ORDER BY segment ASC
        `),
    ]);

    return {
        dates: datesRows.map(r => r.date).filter(Boolean),
        pages: pagesRows.map(r => r.page).filter(Boolean),
        segments: segmentsRows.map(r => r.segment).filter(Boolean),
        statuses: ['All', 'Success', 'Slow', 'Failed'],
    };
}
