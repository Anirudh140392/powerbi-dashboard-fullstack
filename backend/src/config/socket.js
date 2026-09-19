// src/config/socket.js
import { Server } from 'socket.io';
import { verifyToken } from '../services/authService.js';
import { createClient } from '@clickhouse/client';
import dayjs from 'dayjs';

// Cache of ClickHouse clients per database (separate from the main request-scoped cache)
const socketClientCache = new Map();

function getSocketDbClient(dbName) {
    if (socketClientCache.has(dbName)) {
        return socketClientCache.get(dbName);
    }
    const client = createClient({
        url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
        database: dbName,
        request_timeout: 30000,
    });
    socketClientCache.set(dbName, client);
    return client;
}

async function queryDb(dbName, sql) {
    const client = getSocketDbClient(dbName);
    const result = await client.query({ query: sql, format: 'JSONEachRow' });
    return result.json();
}

async function tableExists(dbName, tableName) {
    try {
        const rows = await queryDb(dbName, `EXISTS TABLE ${tableName}`);
        return rows[0]?.result === 1 || rows[0]?.result === '1';
    } catch (e) {
        console.warn(`[Socket] Failed to check table ${tableName} in ${dbName}:`, e.message);
        return false;
    }
}

// Cache of column maps per database/table to avoid DESCRIBE overhead during polling
const columnsCache = new Map(); // Key: `${dbName}:${tableName}` -> Map(lowerKey -> actualName)

async function getTableColumnsMap(dbName, tableName) {
    const cacheKey = `${dbName}:${tableName}`;
    if (columnsCache.has(cacheKey)) {
        return columnsCache.get(cacheKey);
    }
    try {
        const rows = await queryDb(dbName, `DESCRIBE TABLE ${tableName}`);
        const map = new Map();
        rows.forEach(r => {
            const name = r.name || r.Name;
            if (name) map.set(name.toLowerCase(), name);
        });
        columnsCache.set(cacheKey, map);
        return map;
    } catch (e) {
        console.warn(`[Socket] Failed to describe table ${tableName} in ${dbName}:`, e.message);
        return new Map();
    }
}

function resolveColumn(columnsMap, expectedName, fallback = null) {
    if (!columnsMap || columnsMap.size === 0) {
        return fallback || expectedName;
    }
    const lowerExpected = expectedName.toLowerCase();
    if (columnsMap.has(lowerExpected)) {
        return columnsMap.get(lowerExpected);
    }
    // Simple normalization match
    const normalizedTarget = lowerExpected.replace(/[_\s]/g, '');
    for (const [lowerActual, actualName] of columnsMap) {
        if (lowerActual.replace(/[_\s]/g, '') === normalizedTarget) {
            return actualName;
        }
    }
    return fallback || expectedName;
}

/**
 * Fetch Max(Date) from all key tables for a given database
 */
async function fetchMaxDates(dbName) {
    const dates = {};

    // Environment detection: Prod vs Dev
    const chUrl = process.env.CLICKHOUSE_URL || '';
    dates.isProd = chUrl.includes('13.200.55.131');

    // Describe rb_pdp_olap
    const pdpCols = await getTableColumnsMap(dbName, 'rb_pdp_olap');
    const pdpPlatformCol = resolveColumn(pdpCols, 'Platform');
    const pdpDateCol = resolveColumn(pdpCols, 'DATE');
    const pdpCompCol = resolveColumn(pdpCols, 'Comp_flag');
    const pdpDenoCol = resolveColumn(pdpCols, 'deno_osa');
    const pdpSalesCol = resolveColumn(pdpCols, 'Sales');
    const pdpInvCol = resolveColumn(pdpCols, 'Inventory');

    // rb_pdp_olap — general update (used for Business Overview, Availability, and other general page fallbacks)
    try {
        const rows = await queryDb(dbName, `SELECT MAX(toDate(${pdpDateCol})) as maxDate FROM rb_pdp_olap WHERE toString(${pdpCompCol}) = '0'`);
        dates.rb_pdp_olap = rows[0]?.maxDate || null;
        
        const platformRows = await queryDb(dbName, `SELECT ${pdpPlatformCol} as platform, MAX(toDate(${pdpDateCol})) as maxDate FROM rb_pdp_olap WHERE toString(${pdpCompCol}) = '0' GROUP BY ${pdpPlatformCol}`);
        dates.rb_pdp_olap_platform = {};
        platformRows.forEach(r => { if (r.platform) dates.rb_pdp_olap_platform[r.platform] = r.maxDate; });
    } catch (e) {
        console.warn(`[Socket] rb_pdp_olap query failed for ${dbName}:`, e.message);
        dates.rb_pdp_olap = null;
        dates.rb_pdp_olap_platform = {};
    }

    // kpi_osa_platform — OSA presence check (deno_osa > 0)
    try {
        const rows = await queryDb(dbName, `
            SELECT ${pdpPlatformCol} as platform, MAX(toDate(${pdpDateCol})) as maxDate 
            FROM rb_pdp_olap 
            WHERE toString(${pdpCompCol}) = '0' 
              AND ifNull(toFloat64OrZero(toString(${pdpDenoCol})), 0) > 0 
            GROUP BY ${pdpPlatformCol}
        `);
        dates.kpi_osa_platform = {};
        rows.forEach(r => { if (r.platform) dates.kpi_osa_platform[r.platform] = r.maxDate; });
        dates.kpi_osa = Object.values(dates.kpi_osa_platform).sort().pop() || null;
    } catch (e) {
        console.warn(`[Socket] kpi_osa query failed for ${dbName}:`, e.message);
        dates.kpi_osa_platform = {};
        dates.kpi_osa = null;
    }

    // kpi_sales_platform — Sales presence check (Sales > 0)
    try {
        const rows = await queryDb(dbName, `
            SELECT ${pdpPlatformCol} as platform, MAX(toDate(${pdpDateCol})) as maxDate 
            FROM rb_pdp_olap 
            WHERE toString(${pdpCompCol}) = '0' 
              AND ifNull(toFloat64OrZero(toString(${pdpSalesCol})), 0) > 0 
            GROUP BY ${pdpPlatformCol}
        `);
        dates.kpi_sales_platform = {};
        rows.forEach(r => { if (r.platform) dates.kpi_sales_platform[r.platform] = r.maxDate; });
        dates.kpi_sales = Object.values(dates.kpi_sales_platform).sort().pop() || null;
    } catch (e) {
        console.warn(`[Socket] kpi_sales query failed for ${dbName}:`, e.message);
        dates.kpi_sales_platform = {};
        dates.kpi_sales = null;
    }

    // kpi_doi_platform — DOI presence check (Inventory > 0)
    try {
        const rows = await queryDb(dbName, `
            SELECT ${pdpPlatformCol} as platform, MAX(toDate(${pdpDateCol})) as maxDate 
            FROM rb_pdp_olap 
            WHERE toString(${pdpCompCol}) = '0' 
              AND ifNull(toFloat64OrZero(toString(${pdpInvCol})), 0) > 0 
            GROUP BY ${pdpPlatformCol}
        `);
        dates.kpi_doi_platform = {};
        rows.forEach(r => { if (r.platform) dates.kpi_doi_platform[r.platform] = r.maxDate; });
        dates.kpi_doi = Object.values(dates.kpi_doi_platform).sort().pop() || null;
    } catch (e) {
        console.warn(`[Socket] kpi_doi query failed for ${dbName}:`, e.message);
        dates.kpi_doi_platform = {};
        dates.kpi_doi = null;
    }

    // DOI availability per platform — check which platforms have inventory data (last 30 days)
    try {
        const doiRows = await queryDb(dbName, `
            SELECT ${pdpPlatformCol} as platform,
                   SUM(ifNull(toFloat64OrZero(toString(${pdpInvCol})), 0)) as total_inv
            FROM rb_pdp_olap
            WHERE toString(${pdpCompCol}) = '0'
              AND ${pdpDateCol} >= today() - 30
            GROUP BY ${pdpPlatformCol}
        `);
        dates.rb_doi_platforms = {};
        doiRows.forEach(r => {
            if (r.platform) {
                dates.rb_doi_platforms[r.platform] = parseFloat(r.total_inv) > 0;
            }
        });
    } catch (e) {
        console.warn(`[Socket] DOI availability check failed for ${dbName}:`, e.message);
        dates.rb_doi_platforms = {};
    }

    // rb_ms_olap — Market Share page
    try {
        const msCols = await getTableColumnsMap(dbName, 'rb_ms_olap');
        const msPlatformCol = resolveColumn(msCols, 'platform');
        const msDateCol = resolveColumn(msCols, 'created_on');
        const msSalesCol = resolveColumn(msCols, 'sales');

        const platformRows = await queryDb(dbName, `
            SELECT ${msPlatformCol} as platform, MAX(toDate(${msDateCol})) as maxDate 
            FROM rb_ms_olap 
            WHERE ifNull(toFloat64OrZero(toString(${msSalesCol})), 0) > 0
            GROUP BY ${msPlatformCol}
        `);
        dates.rb_ms_olap_platform = {};
        platformRows.forEach(r => { if (r.platform) dates.rb_ms_olap_platform[r.platform] = r.maxDate; });
        dates.rb_ms_olap = Object.values(dates.rb_ms_olap_platform).sort().pop() || null;
    } catch (e) {
        console.warn(`[Socket] rb_ms_olap query failed for ${dbName}:`, e.message);
        dates.rb_ms_olap = null;
        dates.rb_ms_olap_platform = {};
    }

    // rb_kw_olap — Visibility Analysis page
    try {
        const kwCols = await getTableColumnsMap(dbName, 'rb_kw_olap');
        const kwPlatformCol = resolveColumn(kwCols, 'platform_name');
        const kwDateCol = resolveColumn(kwCols, 'DATE');
        const kwOverallCol = resolveColumn(kwCols, 'overall');

        const platformRows = await queryDb(dbName, `
            SELECT ${kwPlatformCol} as platform, MAX(toDate(${kwDateCol})) as maxDate 
            FROM rb_kw_olap 
            WHERE ifNull(toFloat64OrZero(toString(${kwOverallCol})), 0) > 0
            GROUP BY ${kwPlatformCol}
        `);
        dates.rb_kw_olap_platform = {};
        platformRows.forEach(r => { if (r.platform) dates.rb_kw_olap_platform[r.platform] = r.maxDate; });
        dates.rb_kw_olap = Object.values(dates.rb_kw_olap_platform).sort().pop() || null;
    } catch (e) {
        console.warn(`[Socket] rb_kw_olap query failed for ${dbName}:`, e.message);
        dates.rb_kw_olap = null;
        dates.rb_kw_olap_platform = {};
    }

    // rb_pm_olap — Performance Marketing page
    try {
        const pmCols = await getTableColumnsMap(dbName, 'rb_pm_olap');
        const pmPlatformCol = resolveColumn(pmCols, 'Platform');
        const pmDateCol = resolveColumn(pmCols, 'DATE');
        const pmImpCol = resolveColumn(pmCols, 'impressions');

        const platformRows = await queryDb(dbName, `
            SELECT ${pmPlatformCol} as platform, MAX(toDate(${pmDateCol})) as maxDate 
            FROM rb_pm_olap 
            WHERE ifNull(toFloat64OrZero(toString(${pmImpCol})), 0) > 0
            GROUP BY ${pmPlatformCol}
        `);
        dates.rb_pm_olap_platform = {};
        platformRows.forEach(r => { if (r.platform) dates.rb_pm_olap_platform[r.platform] = r.maxDate; });
        dates.rb_pm_olap = Object.values(dates.rb_pm_olap_platform).sort().pop() || null;
    } catch (e) {
        console.warn(`[Socket] rb_pm_olap query failed for ${dbName}:`, e.message);
        dates.rb_pm_olap = null;
        dates.rb_pm_olap_platform = {};
    }


    // tb_content_score_data — Content Analysis page
    try {
        if (await tableExists(dbName, 'tb_content_score_data')) {
            const rows = await queryDb(dbName, `SELECT MAX(toDate(extraction_timestamp)) as maxDate FROM tb_content_score_data`);
            dates.tb_content_score_data = rows[0]?.maxDate || null;
        } else {
            dates.tb_content_score_data = null;
        }
    } catch (e) {
        console.warn(`[Socket] tb_content_score_data query failed for ${dbName}:`, e.message);
        dates.tb_content_score_data = null;
    }

    return dates;
}

// Track active DB rooms to avoid polling unused databases
const activeDbRooms = new Set();

// Store the latest dates per DB to avoid sending duplicate updates
const latestDatesCache = new Map();

let io = null;

/**
 * Initialize Socket.IO server
 * @param {import('http').Server} httpServer - The HTTP server from Express
 */
export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        // Prevent overwhelming the server
        pingInterval: 25000,
        pingTimeout: 20000,
    });

    console.log('🔌 Socket.IO server initialized');

    // Authenticate connections using JWT
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }
            const decoded = verifyToken(token);
            socket.user = decoded;
            socket.dbName = decoded.dbName;
            next();
        } catch (err) {
            console.warn('[Socket] Auth failed:', err.message);
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const { dbName, email } = socket.user || {};
        console.log(`[Socket] ✅ Connected: ${email} (db: ${dbName})`);

        // Join user to their database-specific room
        if (dbName) {
            socket.join(`db:${dbName}`);
            activeDbRooms.add(dbName);
        }

        // Send cached dates immediately on connect (if available)
        if (dbName && latestDatesCache.has(dbName)) {
            socket.emit('maxDateUpdate', latestDatesCache.get(dbName));
        } else if (dbName) {
            // First connection for this DB — fetch immediately
            fetchAndEmit(dbName);
        }

        socket.on('disconnect', () => {
            console.log(`[Socket] ❌ Disconnected: ${email}`);
            // Check if any clients remain in this DB room
            if (dbName) {
                const room = io.sockets.adapter.rooms.get(`db:${dbName}`);
                if (!room || room.size === 0) {
                    activeDbRooms.delete(dbName);
                    console.log(`[Socket] Room db:${dbName} is now empty, pausing polling`);
                }
            }
        });

        // Allow clients to request a manual refresh
        socket.on('requestMaxDates', () => {
            if (dbName) {
                fetchAndEmit(dbName);
            }
        });
    });

    // Start periodic polling (every 5 minutes)
    setInterval(pollAllActiveRooms, 5 * 60 * 1000);

    return io;
}

/**
 * Fetch max dates for a specific DB and emit to all clients in that room
 */
async function fetchAndEmit(dbName) {
    try {
        const dates = await fetchMaxDates(dbName);
        const payload = {
            ...dates,
            updatedAt: new Date().toISOString(),
        };
        latestDatesCache.set(dbName, payload);

        if (io) {
            io.to(`db:${dbName}`).emit('maxDateUpdate', payload);
            console.log(`[Socket] 📤 Emitted maxDateUpdate to db:${dbName}:`, JSON.stringify(dates));
        }
    } catch (err) {
        console.error(`[Socket] Failed to fetch dates for ${dbName}:`, err.message);
    }
}

/**
 * Poll all active DB rooms
 */
async function pollAllActiveRooms() {
    if (activeDbRooms.size === 0) return;
    console.log(`[Socket] ⏰ Polling ${activeDbRooms.size} active DB rooms: ${Array.from(activeDbRooms).join(', ')}`);
    for (const dbName of activeDbRooms) {
        await fetchAndEmit(dbName);
    }
}

export { io, fetchMaxDates };
