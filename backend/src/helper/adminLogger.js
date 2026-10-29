// src/helper/adminLogger.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store log file at backend/admin_log.log
const LOG_FILE_PATH = path.resolve(__dirname, '../../admin_log.log');

/**
 * Appends an admin action audit record to admin_log.log
 * 
 * @param {Object} params
 * @param {string} params.adminEmail - Email of the admin user performing the action
 * @param {string} [params.adminName] - Optional name of the admin user
 * @param {string} [params.adminRole] - Role of the admin user
 * @param {string} [params.targetUser] - Target user email or ID being modified
 * @param {string} [params.targetDatabase] - Target database ID or name
 * @param {string} params.action - Action identifier (e.g. 'UPDATE_TAB_PERMISSIONS', 'UPDATE_DB_STATUS')
 * @param {Object|any} [params.details] - Permission payload or change details
 */
export const logAdminPermissionChange = ({
    adminEmail,
    adminName = '',
    adminRole = 'admin',
    targetUser = '',
    targetDatabase = '',
    action,
    details = {}
}) => {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            admin_user: adminEmail || 'Unknown Admin',
            admin_name: adminName,
            admin_role: adminRole,
            target_user: targetUser,
            target_database: targetDatabase,
            action: action,
            updated_permissions: details
        };

        const line = JSON.stringify(logEntry) + '\n';
        fs.appendFileSync(LOG_FILE_PATH, line, 'utf8');
        console.log(`[AdminLogger] ✅ Recorded permission update by ${adminEmail} for target "${targetUser || targetDatabase}"`);
    } catch (err) {
        console.error('[AdminLogger] ❌ Failed to write log entry:', err.message);
    }
};

/**
 * Reads recent admin audit log entries from admin_log.log
 * @param {number} [limit=100] Max number of recent log entries to return
 * @returns {Array<Object>} List of log entry objects
 */
export const readAdminLogs = (limit = 100) => {
    try {
        if (!fs.existsSync(LOG_FILE_PATH)) {
            return [];
        }
        const fileContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const lines = fileContent.trim().split('\n').filter(Boolean);
        const entries = [];

        for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
            try {
                entries.push(JSON.parse(lines[i]));
            } catch (_) {
                entries.push({ raw: lines[i] });
            }
        }
        return entries;
    } catch (err) {
        console.error('[AdminLogger] Failed to read log file:', err.message);
        return [];
    }
};
