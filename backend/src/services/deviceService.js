// src/services/deviceService.js
// Trusted Device helpers — uses columns on the existing tb_user table.
// No new table needed; just ALTER TABLE ADD COLUMN (safe, no data loss).

import { v4 as uuidv4 } from 'uuid';
import { queryAdminDB } from '../config/adminClickhouse.js';

/**
 * Add device verification columns to tb_user if they don't already exist.
 * This is a safe ALTER TABLE operation — existing rows get default values.
 * Called once on server startup.
 */
export async function ensureDeviceTokenColumn() {
    try {
        const columnsToAdd = [
            { name: 'device_token', type: 'String', defaultVal: "''" },
            { name: 'browser', type: 'String', defaultVal: "''" },
            { name: 'browser_version', type: 'String', defaultVal: "''" },
            { name: 'operating_system', type: 'String', defaultVal: "''" },
            { name: 'platform', type: 'String', defaultVal: "''" }
        ];

        for (const col of columnsToAdd) {
            const cols = await queryAdminDB(`
                SELECT name FROM system.columns
                WHERE database = 'admin_master'
                  AND table    = 'tb_user'
                  AND name     = '${col.name}'
            `);

            if (cols.length === 0) {
                await queryAdminDB(`
                    ALTER TABLE tb_user ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.defaultVal}
                `);
                console.log(`[DeviceService] ✅ Added ${col.name} column to tb_user`);
            }
        }
        console.log('[DeviceService] ✅ All device metadata columns verified in tb_user');
    } catch (err) {
        console.warn('[DeviceService] Column check/add note:', err.message);
    }
}

/**
 * Generate a new device token (UUID v4).
 */
export function generateDeviceToken() {
    return uuidv4();
}

/**
 * Cookie configuration for the device_token.
 * HTTP-only, Secure in production, SameSite=Lax, 1-year expiry.
 */
export function getDeviceCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,       // Only HTTPS in production
        sameSite: 'Lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year in ms
        path: '/',
    };
}
