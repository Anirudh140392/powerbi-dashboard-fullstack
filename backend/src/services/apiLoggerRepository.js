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
    'empty_response': 'empty_response',
    'emptyResponse': 'empty_response',
    'client_db': 'client_db',
    'clientDb': 'client_db',
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
                empty_response UInt8 DEFAULT 0,
                client_db String DEFAULT '',
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
            { name: 'empty_response', type: 'UInt8 DEFAULT 0' },
            { name: 'client_db', type: "String DEFAULT ''" },
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
 * Idempotent run support: deletes any existing rows for the given run date, page, and optional clientDb
 * before inserting new run results.
 */
export async function deleteLogsForDateAndPage(dateStr, pageName, clientDb = '') {
    try {
        console.log(`[ApiLoggerRepo] Idempotent delete: checking existing records for date=${dateStr}, page=${pageName}, clientDb=${clientDb || 'ANY'}...`);
        const safeDate = String(dateStr).replace(/'/g, "''");
        const safePage = String(pageName).replace(/'/g, "''");
        let deleteSql = `ALTER TABLE admin_master.api_logs DELETE WHERE toDate(Date) = toDate('${safeDate}') AND Page = '${safePage}'`;
        if (clientDb) {
            const safeClientDb = String(clientDb).replace(/'/g, "''");
            deleteSql += ` AND client_db = '${safeClientDb}'`;
        }
        await queryAdminDB(deleteSql);
        return { success: true };
    } catch (err) {
        console.warn(`[ApiLoggerRepo] Note on idempotent delete:`, err.message);
        return { success: false };
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
            empty_response: Number(r.empty_response ?? r.emptyResponse ?? 0) === 1 ? 1 : 0,
            client_db: String(r.client_db || r.clientDb || ''),
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
    emptyResponse = '',
    clientDb = '',
    client_db = '',
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
        if (status === 'Empty') {
            whereClauses.push('empty_response = 1');
        } else {
            whereClauses.push('response_status = {targetStatus:String}');
            params.targetStatus = status;
        }
    }

    if (emptyResponse !== undefined && emptyResponse !== '' && emptyResponse !== 'All') {
        whereClauses.push('empty_response = {targetEmptyResponse:UInt8}');
        params.targetEmptyResponse = Number(emptyResponse) === 1 ? 1 : 0;
    }

    const selectedClient = clientDb || client_db;
    if (selectedClient && selectedClient !== 'All') {
        whereClauses.push('client_db = {targetClientDb:String}');
        params.targetClientDb = selectedClient;
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
            empty_response,
            client_db,
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
        emptyResponse: Number(r.empty_response) || 0,
        clientDb: r.client_db || '',
        client_db: r.client_db || '',
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
export async function getSummary({ date = '', page = '', clientDb = '', client_db = '' } = {}) {
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

    const selectedClient = clientDb || client_db;
    if (selectedClient && selectedClient !== 'All') {
        whereClauses.push('client_db = {targetClientDb:String}');
        params.targetClientDb = selectedClient;
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
        SELECT 
            count() as total_apis,
            countIf(response_status = 'Success') as success_count,
            countIf(response_status = 'Failed') as failed_count,
            countIf(response_status = 'Slow') as slow_count,
            countIf(empty_response = 1) as empty_response_count,
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
    const emptyResponseCount = Number(row.empty_response_count) || 0;
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
        emptyResponseCount,
        successRate,
        avgResponseTimeMs,
        lastRunAt,
        latestDate,
    };
}

/**
 * Fetch distinct filter values (available dates, pages, segments, and client databases) for UI dropdowns.
 */
export async function getFilterOptions() {
    const daysBack = Math.max(1, RETENTION_DAYS - 1);

    const [datesRows, pagesRows, segmentsRows, logClientsRows, tbClientsRows] = await Promise.all([
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
        queryAdminDB(`
            SELECT DISTINCT client_db 
            FROM admin_master.api_logs 
            WHERE client_db IS NOT NULL AND client_db != ''
            ORDER BY client_db ASC
        `).catch(() => []),
        queryAdminDB(`
            SELECT DISTINCT db_name 
            FROM admin_master.tb_database 
            WHERE status = 'active'
            ORDER BY db_name ASC
        `).catch(() => []),
    ]);

    const clientSet = new Set();
    logClientsRows.forEach(r => { if (r.client_db) clientSet.add(r.client_db); });
    tbClientsRows.forEach(r => { if (r.db_name) clientSet.add(r.db_name); });
    const clients = Array.from(clientSet).sort();

    return {
        dates: datesRows.map(r => r.date).filter(Boolean),
        pages: pagesRows.map(r => r.page).filter(Boolean),
        segments: segmentsRows.map(r => r.segment).filter(Boolean),
        clients,
        statuses: ['All', 'Success', 'Slow', 'Failed'],
        emptyResponses: [
            { label: 'All Responses', value: 'All' },
            { label: '0 (Not Empty)', value: '0' },
            { label: '1 (Empty Response)', value: '1' },
        ],
    };
}

/**
 * Fetch 2-day health distribution and complete API listings grouped by status.
 * Provides multiple scopes: '2days' (all runs), 'today' (single run 171), and 'unique' (154 distinct endpoints).
 */
export async function getDistribution({ page = '', clientDb = '', client_db = '', days = 2 } = {}) {
    const daysBack = Math.max(1, Number(days) - 1);
    const whereClauses = [`toDate(Date) >= today() - ${daysBack}`];
    const params = {};

    if (page && page !== 'All' && page !== 'All Pages') {
        whereClauses.push('Page = {targetPage:String}');
        params.targetPage = page;
    }

    const selectedClient = clientDb || client_db;
    if (selectedClient && selectedClient !== 'All') {
        whereClauses.push('client_db = {targetClientDb:String}');
        params.targetClientDb = selectedClient;
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
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
            empty_response,
            client_db,
            error_message
        FROM admin_master.api_logs
        ${whereSql}
        ORDER BY response_time_ms DESC, Page ASC, api ASC
    `;

    const rawRows = await queryAdminDB(sql, params);

    // Collect all distinct dates sorted descending
    const dateSet = new Set();
    for (const r of rawRows) {
        if (r.date) dateSet.add(r.date);
    }
    const dates = Array.from(dateSet).sort().reverse();
    const latestDate = dates[0] || dayjs().format('YYYY-MM-DD');
    const previousDate = dates[1] || dayjs(latestDate).subtract(1, 'day').format('YYYY-MM-DD');

    const all2Days = { success: [], empty: [], slow: [], failed: [] };
    const todayData = { success: [], empty: [], slow: [], failed: [] };
    const yesterdayData = { success: [], empty: [], slow: [], failed: [] };
    const uniqueMap = new Map();

    for (const r of rawRows) {
        const isFailed = r.response_status === 'Failed' || Number(r.status_code) >= 400 || Number(r.status_code) === 0;
        const isEmpty = Number(r.empty_response) === 1 && !isFailed;
        const isSlow = (r.response_status === 'Slow' || Number(r.response_time_ms) > 5000) && !isFailed && !isEmpty;

        let categoryKey = 'success';
        if (isFailed) {
            categoryKey = 'failed';
        } else if (isEmpty) {
            // Status 200 OK with empty response payload!
            categoryKey = 'empty';
        } else if (isSlow) {
            categoryKey = 'slow';
        } else {
            categoryKey = 'success';
        }

        const categoryLabel = categoryKey === 'empty' ? 'Empty' : (categoryKey === 'failed' ? 'Failed' : (categoryKey === 'slow' ? 'Slow' : 'Success'));

        const item = {
            id: r.id,
            date: r.date,
            timestamp: r.timestamp,
            page: r.page || 'General',
            segment: r.segment || 'General',
            api: r.api,
            statusCode: Number(r.status_code) || 0,
            responseStatus: r.response_status || 'Unknown',
            category: categoryLabel,
            healthStatus: categoryLabel,
            responseTimeMs: Number(r.response_time_ms) || 0,
            emptyResponse: Number(r.empty_response) || 0,
            clientDb: r.client_db || '',
            client_db: r.client_db || '',
            errorMessage: r.error_message || '',
        };

        // 1. All 2-day combined runs
        all2Days[categoryKey].push(item);

        // 2. Today's runs (r.date === latestDate)
        if (r.date === latestDate) {
            todayData[categoryKey].push(item);
        } else if (r.date === previousDate) {
            // 3. Yesterday's runs (r.date === previousDate)
            yesterdayData[categoryKey].push(item);
        }

        // 4. Unique endpoints (deduplicate by page + api)
        const key = `${r.page || ''}:::${r.api || ''}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
        } else {
            const existing = uniqueMap.get(key);
            if (categoryKey === 'failed' || (categoryKey === 'empty' && existing.category === 'success') || (categoryKey === 'slow' && existing.category === 'success')) {
                uniqueMap.set(key, item);
            }
        }
    }

    const uniqueApis = Array.from(uniqueMap.values());
    const uniqueData = {
        success: uniqueApis.filter(a => a.category === 'Success'),
        empty: uniqueApis.filter(a => a.category === 'Empty'),
        slow: uniqueApis.filter(a => a.category === 'Slow'),
        failed: uniqueApis.filter(a => a.category === 'Failed'),
    };

    const buildBreakdown = (category, dayLabel = '', dateStr = '') => {
        const totalCount = category.success.length + category.empty.length + category.slow.length + category.failed.length;
        return [
            {
                name: dayLabel ? `${dayLabel} Success` : 'Success (Has Data)',
                status: 'Success',
                day: dayLabel,
                date: dateStr,
                value: category.success.length,
                percentage: totalCount > 0 ? Math.round((category.success.length / totalCount) * 1000) / 10 : 0,
                color: '#10b981', // Emerald Green
                apis: category.success,
            },
            {
                name: dayLabel ? `${dayLabel} Empty (200 OK)` : 'Empty Response (200 OK)',
                status: 'Empty',
                day: dayLabel,
                date: dateStr,
                value: category.empty.length,
                percentage: totalCount > 0 ? Math.round((category.empty.length / totalCount) * 1000) / 10 : 0,
                color: '#8b5cf6', // Violet Purple
                apis: category.empty,
            },
            {
                name: dayLabel ? `${dayLabel} Slow` : 'Slow API',
                status: 'Slow',
                day: dayLabel,
                date: dateStr,
                value: category.slow.length,
                percentage: totalCount > 0 ? Math.round((category.slow.length / totalCount) * 1000) / 10 : 0,
                color: '#f59e0b', // Amber Yellow
                apis: category.slow,
            },
            {
                name: dayLabel ? `${dayLabel} Failed` : 'Failed API',
                status: 'Failed',
                day: dayLabel,
                date: dateStr,
                value: category.failed.length,
                percentage: totalCount > 0 ? Math.round((category.failed.length / totalCount) * 1000) / 10 : 0,
                color: '#ef4444', // Red
                apis: category.failed,
            },
        ];
    };

    const todayLabel = `Today (${dayjs(latestDate).format('DD MMM')})`;
    const yesterdayLabel = `Yesterday (${dayjs(previousDate).format('DD MMM')})`;

    const breakdown2Days = buildBreakdown(all2Days);
    const breakdownToday = buildBreakdown(todayData, todayLabel, latestDate);
    const breakdownYesterday = buildBreakdown(yesterdayData, yesterdayLabel, previousDate);
    const breakdownUnique = buildBreakdown(uniqueData);

    const totalCombined = rawRows.length;
    // Segmented breakdown for combined 2-day chart with clear day differentiation
    const segmented2Days = [
        {
            id: 'today-success',
            name: `${todayLabel} - Success`,
            status: 'Success',
            day: 'Today',
            date: latestDate,
            dayLabel: todayLabel,
            value: todayData.success.length,
            percentage: totalCombined > 0 ? Math.round((todayData.success.length / totalCombined) * 1000) / 10 : 0,
            color: '#10b981', // Emerald Green
            apis: todayData.success,
        },
        {
            id: 'today-empty',
            name: `${todayLabel} - Empty (200 OK)`,
            status: 'Empty',
            day: 'Today',
            date: latestDate,
            dayLabel: todayLabel,
            value: todayData.empty.length,
            percentage: totalCombined > 0 ? Math.round((todayData.empty.length / totalCombined) * 1000) / 10 : 0,
            color: '#8b5cf6', // Violet Purple
            apis: todayData.empty,
        },
        {
            id: 'today-slow',
            name: `${todayLabel} - Slow API`,
            status: 'Slow',
            day: 'Today',
            date: latestDate,
            dayLabel: todayLabel,
            value: todayData.slow.length,
            percentage: totalCombined > 0 ? Math.round((todayData.slow.length / totalCombined) * 1000) / 10 : 0,
            color: '#f59e0b', // Amber Yellow
            apis: todayData.slow,
        },
        {
            id: 'today-failed',
            name: `${todayLabel} - Failed API`,
            status: 'Failed',
            day: 'Today',
            date: latestDate,
            dayLabel: todayLabel,
            value: todayData.failed.length,
            percentage: totalCombined > 0 ? Math.round((todayData.failed.length / totalCombined) * 1000) / 10 : 0,
            color: '#ef4444', // Red
            apis: todayData.failed,
        },
        {
            id: 'yesterday-success',
            name: `${yesterdayLabel} - Success`,
            status: 'Success',
            day: 'Yesterday',
            date: previousDate,
            dayLabel: yesterdayLabel,
            value: yesterdayData.success.length,
            percentage: totalCombined > 0 ? Math.round((yesterdayData.success.length / totalCombined) * 1000) / 10 : 0,
            color: '#06b6d4', // Cyan / Teal
            apis: yesterdayData.success,
        },
        {
            id: 'yesterday-empty',
            name: `${yesterdayLabel} - Empty (200 OK)`,
            status: 'Empty',
            day: 'Yesterday',
            date: previousDate,
            dayLabel: yesterdayLabel,
            value: yesterdayData.empty.length,
            percentage: totalCombined > 0 ? Math.round((yesterdayData.empty.length / totalCombined) * 1000) / 10 : 0,
            color: '#a78bfa', // Lavender Purple Light
            apis: yesterdayData.empty,
        },
        {
            id: 'yesterday-slow',
            name: `${yesterdayLabel} - Slow API`,
            status: 'Slow',
            day: 'Yesterday',
            date: previousDate,
            dayLabel: yesterdayLabel,
            value: yesterdayData.slow.length,
            percentage: totalCombined > 0 ? Math.round((yesterdayData.slow.length / totalCombined) * 1000) / 10 : 0,
            color: '#fbbf24', // Amber Light
            apis: yesterdayData.slow,
        },
        {
            id: 'yesterday-failed',
            name: `${yesterdayLabel} - Failed API`,
            status: 'Failed',
            day: 'Yesterday',
            date: previousDate,
            dayLabel: yesterdayLabel,
            value: yesterdayData.failed.length,
            percentage: totalCombined > 0 ? Math.round((yesterdayData.failed.length / totalCombined) * 1000) / 10 : 0,
            color: '#f87171', // Rose Light
            apis: yesterdayData.failed,
        },
    ];

    return {
        latestDate,
        previousDate,
        total: rawRows.length,
        days: Number(days) || 2,
        breakdown: breakdown2Days,
        scopes: {
            'today': {
                label: 'Today Only',
                sublabel: `${latestDate} single test run`,
                total: todayData.success.length + todayData.empty.length + todayData.slow.length + todayData.failed.length,
                breakdown: breakdownToday,
            },
            '2days': {
                label: 'Last 2 Days Combined',
                sublabel: 'Combined test runs across 48h with day-level breakdown',
                total: rawRows.length,
                breakdown: breakdown2Days,
                segmentedBreakdown: segmented2Days,
                today: {
                    date: latestDate,
                    label: todayLabel,
                    total: todayData.success.length + todayData.empty.length + todayData.slow.length + todayData.failed.length,
                    breakdown: breakdownToday,
                },
                yesterday: {
                    date: previousDate,
                    label: yesterdayLabel,
                    total: yesterdayData.success.length + yesterdayData.empty.length + yesterdayData.slow.length + yesterdayData.failed.length,
                    breakdown: breakdownYesterday,
                },
            },
            'unique': {
                label: 'Unique Endpoints',
                sublabel: 'Deduplicated distinct endpoints',
                total: uniqueApis.length,
                breakdown: breakdownUnique,
            },
        },
        daysData: {
            today: {
                date: latestDate,
                label: todayLabel,
                total: todayData.success.length + todayData.empty.length + todayData.slow.length + todayData.failed.length,
                breakdown: breakdownToday,
            },
            yesterday: {
                date: previousDate,
                label: yesterdayLabel,
                total: yesterdayData.success.length + yesterdayData.empty.length + yesterdayData.slow.length + yesterdayData.failed.length,
                breakdown: breakdownYesterday,
            },
        },
        successApis: all2Days.success,
        emptyApis: all2Days.empty,
        slowApis: all2Days.slow,
        failedApis: all2Days.failed,
    };
}
