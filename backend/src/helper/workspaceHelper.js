// src/helper/workspaceHelper.js
// Who the request is for: the workspace's db_id and whether the user is an admin.
import { queryAdminDB } from '../config/adminClickhouse.js';

/** The tenant's db_id for the workspace the user is in (req.user.dbName honours the workspace switcher). */
export const resolveDbId = async (user) => {
    if (user?.dbName) {
        const [row] = await queryAdminDB(
            `SELECT toString(db_id) AS db_id FROM tb_database WHERE lower(db_name) = {dbName:String} LIMIT 1`,
            { dbName: user.dbName.toLowerCase() }
        );
        if (row?.db_id) return row.db_id;
    }
    return user?.dbId || '';
};

export const isAdmin = (user) => /admin|super/.test(String(user?.role || '').toLowerCase());

export const userEmail = (user) => String(user?.email || '').toLowerCase();
