// src/services/visitorService.js
import { insertAdminDB, queryAdminDB } from '../config/adminClickhouse.js';

/**
 * Record a visitor entry in admin_master.tb_visitors
 * Table schema:
 *   `DATE` DateTime DEFAULT now(),
 *   `email` Nullable(String),
 *   `client_db` Nullable(String),
 *   `page` Nullable(String)
 *
 * @param {object} params
 * @param {string} params.email - User email
 * @param {string} params.client_db - Client database name
 * @param {string} params.page - Visited page (e.g. '/watch-tower', '/login')
 */
export async function recordVisitor({ email, client_db, page }) {
    try {
        const cleanEmail = email ? String(email).trim().toLowerCase() : null;
        let cleanClientDb = client_db ? String(client_db).trim().toLowerCase() : null;
        const cleanPage = page ? String(page).trim() : null;

        // Fallback: If client_db is missing but email is provided, lookup client db from tb_user + tb_database
        if (!cleanClientDb && cleanEmail) {
            try {
                const userDbRows = await queryAdminDB(
                    `SELECT d.db_name 
                     FROM admin_master.tb_user u 
                     LEFT JOIN admin_master.tb_database d ON toString(u.db_id) = toString(d.db_id) 
                     WHERE lower(u.user_email) = lower({email:String}) 
                     ORDER BY u.last_login DESC 
                     LIMIT 1`,
                    { email: cleanEmail }
                );
                if (userDbRows && userDbRows.length > 0 && userDbRows[0].db_name) {
                    cleanClientDb = String(userDbRows[0].db_name).trim().toLowerCase();
                }
            } catch (lookupErr) {
                console.warn('[VisitorService] Failed to lookup client_db for email:', lookupErr.message);
            }
        }

        // Must have at least email or page to record
        if (!cleanEmail && !cleanPage) {
            return;
        }

        await insertAdminDB('admin_master.tb_visitors', [{
            email: cleanEmail,
            client_db: cleanClientDb,
            page: cleanPage,
        }]);

        console.log(`[VisitorTracker] Visit recorded: email="${cleanEmail}", client_db="${cleanClientDb}", page="${cleanPage}"`);
    } catch (err) {
        console.error('[VisitorService] Failed to record visit in admin_master.tb_visitors:', err.message);
    }
}

/**
 * Fetch recent visitor entries from admin_master.tb_visitors
 * @param {number} limit
 */
export async function getRecentVisitors(limit = 100) {
    try {
        const rows = await queryAdminDB(
            `SELECT DATE, email, client_db, page 
             FROM admin_master.tb_visitors 
             ORDER BY DATE DESC 
             LIMIT {limit:UInt32}`,
            { limit: Math.min(Math.max(limit, 1), 1000) }
        );
        return rows;
    } catch (err) {
        console.error('[VisitorService] Failed to query tb_visitors:', err.message);
        throw err;
    }
}
