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

/**
 * Fetch Max(Date) from all key tables for a given database
 */
async function fetchMaxDates(dbName) {
    const dates = {};

    // rb_pdp_olap — used by most pages
    try {
        const rows = await queryDb(dbName, `SELECT MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap WHERE toString(Comp_flag) = '0'`);
        dates.rb_pdp_olap = rows[0]?.maxDate || null;
    } catch (e) {
        console.warn(`[Socket] rb_pdp_olap query failed for ${dbName}:`, e.message);
        dates.rb_pdp_olap = null;
    }

    // rb_ms_olap — Market Share page
    try {
        const rows = await queryDb(dbName, `SELECT MAX(toDate(created_on)) as maxDate FROM rb_ms_olap`);
        dates.rb_ms_olap = rows[0]?.maxDate || null;
    } catch (e) {
        console.warn(`[Socket] rb_ms_olap query failed for ${dbName}:`, e.message);
        dates.rb_ms_olap = null;
    }

    // rb_kw_olap — Visibility Analysis page
    try {
        const rows = await queryDb(dbName, `SELECT MAX(toDate(DATE)) as maxDate FROM rb_kw_olap`);
        dates.rb_kw_olap = rows[0]?.maxDate || null;
    } catch (e) {
        console.warn(`[Socket] rb_kw_olap query failed for ${dbName}:`, e.message);
        dates.rb_kw_olap = null;
    }

    // rb_pm_olap — Performance Marketing page
    try {
        const rows = await queryDb(dbName, `SELECT MAX(toDate(DATE)) as maxDate FROM rb_pm_olap`);
        dates.rb_pm_olap = rows[0]?.maxDate || null;
    } catch (e) {
        console.warn(`[Socket] rb_pm_olap query failed for ${dbName}:`, e.message);
        dates.rb_pm_olap = null;
    }

    // tb_content_score_data — Content Analysis page
    try {
        const rows = await queryDb(dbName, `SELECT MAX(toDate(extraction_timestamp)) as maxDate FROM tb_content_score_data`);
        dates.tb_content_score_data = rows[0]?.maxDate || null;
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
    console.log(`[Socket] ⏰ Polling ${activeDbRooms.size} active DB rooms...`);
    for (const dbName of activeDbRooms) {
        await fetchAndEmit(dbName);
    }
}

export { io };
