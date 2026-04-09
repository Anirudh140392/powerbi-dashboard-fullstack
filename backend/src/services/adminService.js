// src/services/adminService.js
import { queryAdminDB } from '../config/adminClickhouse.js';

/**
 * Fetch all users with their associated database name
 */
export const getAllUsers = async () => {
    try {
        // 1. Fetch users from tb_user
        const usersQuery = `
            SELECT 
                user_id as id,
                user_name as name,
                user_email as email,
                user_role as role,
                status as status,
                toString(db_id) as db_id,
                created_on as joined,
                last_login
            FROM tb_user
            WHERE status != 'deleted'
            ORDER BY created_on DESC
        `;
        const users = await queryAdminDB(usersQuery);

        // 2. Fetch all databases from tb_database
        const databasesQuery = `
            SELECT 
                db_name, 
                toString(db_id) as db_id 
            FROM tb_database
        `;
        const databases = await queryAdminDB(databasesQuery);

        // 3. Create a map for quick DB name lookups
        const dbMap = new Map();
        databases.forEach(db => {
            dbMap.set(db.db_id, db.db_name);
        });

        // 4. Map DB names to users (handle potential bigInt precision issues by manually comparing)
        return users.map(user => {
            const userDbIdStr = user.db_id;
            let finalDbName = 'N/A';

            // Try direct map lookup first
            if (dbMap.has(userDbIdStr)) {
                const rawDbName = dbMap.get(userDbIdStr);
                // Format: MARS_PETCARE -> Mars Petcare
                finalDbName = rawDbName
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            } else {
                // If no direct string match, find closest match for UInt64 precision (bigInt)
                try {
                    const userDbIdNum = BigInt(userDbIdStr);
                    let closestDb = null;
                    let closestDiff = BigInt('999999999999999999');

                    for (const [dbId, name] of dbMap.entries()) {
                        const dbIdNum = BigInt(dbId);
                        const diff = userDbIdNum > dbIdNum ? userDbIdNum - dbIdNum : dbIdNum - userDbIdNum;
                        if (diff < closestDiff) {
                            closestDiff = diff;
                            closestDb = name;
                        }
                    }

                    // Only accept if difference is very small (within tolerance for UInt64 precision errors)
                    if (closestDiff < BigInt('1000')) {
                        finalDbName = closestDb;
                    }
                } catch (e) {
                    console.warn(`[AdminService] Error matching db_id for user ${user.id}:`, e.message);
                }
            }

            return {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                dbName: finalDbName,
                joined: user.joined ? new Date(user.joined).toISOString().split('T')[0] : 'N/A',
                lastLogin: user.last_login ? new Date(user.last_login).toISOString().replace('T', ' ').split('.')[0] : 'Never'
            };
        });
    } catch (error) {
        console.error('[AdminService] getAllUsers failed:', error.message);
        throw error;
    }
};

/**
 * Soft delete a user by updating their status to 'deleted'
 * @param {string} userId - The user ID to delete
 */
export const softDeleteUser = async (userId) => {
    try {
        const query = `
            ALTER TABLE tb_user 
            UPDATE status = 'deleted' 
            WHERE user_id = ${userId}
        `;

        await queryAdminDB(query);
        return { success: true };
    } catch (error) {
        console.error(`[AdminService] softDeleteUser failed for ${userId}:`, error.message);
        throw error;
    }
};

/**
 * Fetch live users with activity status based on last_login transition
 */
export const getLiveUsers = async () => {
    try {
        const query = `
            SELECT 
                user_id as id,
                user_name as name,
                user_email as email,
                user_role as role,
                last_login,
                if(dateDiff('minute', last_login, now()) <= 10, 'Active', 'Away') as status
            FROM tb_user
            WHERE status != 'deleted' AND dateDiff('minute', last_login, now()) <= 10
            ORDER BY last_login DESC
        `;

        const users = await queryAdminDB(query);

        return users.map(user => ({
            ...user,
            id: user.id.toString(),
            initials: user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'
        }));
    } catch (error) {
        console.error('[AdminService] getLiveUsers failed:', error.message);
        throw error;
    }
};

/**
 * Fetch all pending access requests
 */
export const getPendingRequests = async () => {
    try {
        // Fetch all rows where access = 'pending'
        const query = `
            SELECT 
                toString(id) as id,
                user_email as email,
                user_name as name,
                toString(db_id) as db_id,
                ip,
                last_login as dateTime,
                access as status
            FROM tb_user
            WHERE access = 'pending'
            AND last_login >= today()
            ORDER BY last_login DESC
            LIMIT 1 BY user_email, ip
        `;
        const requests = await queryAdminDB(query);

        // Fetch databases to map names
        const databases = await queryAdminDB("SELECT db_name, toString(db_id) as db_id FROM tb_database");
        const dbMap = new Map();
        databases.forEach(db => dbMap.set(db.db_id, db.db_name));

        return requests.map(req => {
            const userDbIdStr = req.db_id;
            let finalDbName = 'Unknown';

            // 1. Try direct map lookup first
            if (dbMap.has(userDbIdStr)) {
                finalDbName = dbMap.get(userDbIdStr);
            } else {
                // 2. Fuzzy match for BigInt/UInt64 precision issues
                try {
                    const userDbIdNum = BigInt(userDbIdStr);
                    let closestDb = null;
                    let closestDiff = BigInt('999999999999999999');

                    for (const [dbId, name] of dbMap.entries()) {
                        const dbIdNum = BigInt(dbId);
                        const diff = userDbIdNum > dbIdNum ? userDbIdNum - dbIdNum : dbIdNum - userDbIdNum;
                        if (diff < closestDiff) {
                            closestDiff = diff;
                            closestDb = name;
                        }
                    }

                    // Accept if difference is very small (within tolerance for UInt64 precision errors)
                    if (closestDiff < BigInt('1000')) {
                        finalDbName = closestDb;
                    }
                } catch (e) {
                    console.warn(`[AdminService] Error matching db_id for request ${req.id}:`, e.message);
                }
            }

            return {
                ...req,
                dbName: finalDbName,
                dateTime: req.dateTime ? new Date(req.dateTime).toISOString().replace('T', ' ').split('.')[0] : 'N/A'
            };
        });
    } catch (error) {
        console.error('[AdminService] getPendingRequests failed:', error.message);
        throw error;
    }
};

/**
 * Update the access status for a specific login record
 */
export const updateUserAccess = async (id, status) => {
    try {
        // Find the record by id and update its access column
        // Using ALTER TABLE UPDATE for ClickHouse Mutations
        const query = `
            ALTER TABLE tb_user 
            UPDATE access = '${status}' 
            WHERE toString(id) = '${id}'
        `;

        await queryAdminDB(query);
        return { success: true };
    } catch (error) {
        console.error(`[AdminService] updateUserAccess failed for ${id}:`, error.message);
        throw error;
    }
};
