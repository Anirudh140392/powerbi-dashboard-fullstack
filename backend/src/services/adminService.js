// src/services/adminService.js
import { queryAdminDB, insertAdminDB } from '../config/adminClickhouse.js';
import bcrypt from 'bcrypt';

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
            SELECT DISTINCT 
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
            ORDER BY last_login DESC
            LIMIT 1 BY user_email, ip
        `;
        const requests = await queryAdminDB(query);

        // Fetch databases to map names
        const databases = await queryAdminDB("SELECT DISTINCT db_name, toString(db_id) as db_id FROM tb_database");
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
export const updateUserAccess = async (id, status, userName) => {
    try {
        // Find the record by id and update its access column
        // Using ALTER TABLE UPDATE for ClickHouse Mutations
        let query;
        if (userName) {
            const safeUserName = userName.replace(/'/g, "\\'");
            
            // user_id is a sorting key in ClickHouse, so we cannot update it via ALTER TABLE UPDATE.
            // We must insert a new row with the new user_id and delete the old pending row.
            const existing = await queryAdminDB(`
                SELECT 
                    user_email,
                    user_role,
                    password_hash,
                    toString(db_id) as db_id_str,
                    created_on,
                    status as row_status,
                    ip,
                    db_status,
                    tab_permissions
                FROM tb_user 
                WHERE toString(id) = '${id}' 
                LIMIT 1
            `);
            
            if (existing && existing.length > 0) {
                const user = existing[0];
                
                // Get the new hash for user_name
                const hashRes = await queryAdminDB(`SELECT toString(cityHash64('${safeUserName}')) as hash`);
                const newUserId = hashRes[0].hash;
                const newRowId = Date.now().toString();
                
                // Insert the new record representing the approved state
                await insertAdminDB('tb_user', [{
                    id: newRowId,
                    user_id: newUserId,
                    user_email: user.user_email,
                    user_name: safeUserName,
                    user_role: user.user_role,
                    password_hash: user.password_hash,
                    db_id: user.db_id_str,
                    last_login: new Date().toISOString().replace('T', ' ').split('.')[0],
                    created_on: user.created_on,
                    status: user.row_status,
                    ip: user.ip,
                    access: status,
                    db_status: user.db_status || 'active',
                    tab_permissions: user.tab_permissions || ''
                }]);
                
                // Delete the old row
                await queryAdminDB(`ALTER TABLE tb_user DELETE WHERE toString(id) = '${id}'`);
            } else {
                throw new Error("Pending access request not found.");
            }
        } else {
            const query = `
                ALTER TABLE tb_user 
                UPDATE access = '${status}' 
                WHERE toString(id) = '${id}'
            `;
            await queryAdminDB(query);
        }

        return { success: true };
    } catch (error) {
        console.error(`[AdminService] updateUserAccess failed for ${id}:`, error.message);
        throw error;
    }
};

/**
 * Helper to convert flat permissions (e.g. platform_blinkit: true) to nested format:
 * {
 *   "Business Overview": true,
 *   "platform": {
 *     "blinkit": true
 *   }
 * }
 */
const tabsList = [
    "Business Overview", "India Overview", "Availability Analysis",
    "Market Coverage", "Visibility Analysis", "Market Share", "Sales Data",
    "Pricing Analysis", "Performance Marketing", "Portfolio Analysis", "Content Analysis",
    "Inventory Analysis", "Play it Yourself", "Category RCA",
    "Scheduled Reports", "Download Report", "Ad Auto", "Rating", "Supply", "PDS Score"
];

/**
 * Helper to convert flat permissions (e.g. platform_blinkit: true, kpi_Business Overview_offtake: true) to nested format:
 * {
 *   "Business Overview": {
 *     "access": true,
 *     "kpi": {
 *       "offtake": true
 *     }
 *   },
 *   "platform": {
 *     "blinkit": true
 *   }
 * }
 */
export const toNestedPermissions = (flatPerms) => {
    if (!flatPerms) return {};
    const nested = {};
    const platform = {};
    
    // First, set up access for tabs and platforms
    Object.keys(flatPerms).forEach(key => {
        if (key.startsWith('platform_')) {
            const platName = key.replace('platform_', '').toLowerCase();
            platform[platName] = flatPerms[key];
        } else if (key.startsWith('kpi_')) {
            // Handled in second pass
        } else if (key !== 'platform') {
            nested[key] = {
                access: flatPerms[key],
                kpi: {}
            };
        }
    });
    
    // Second, nest the KPIs under their respective tabs
    Object.keys(flatPerms).forEach(key => {
        if (key.startsWith('kpi_')) {
            const remaining = key.replace('kpi_', '');
            const matchingTab = tabsList.find(tab => remaining.startsWith(tab + '_'));
            if (matchingTab) {
                const kpiIdStr = remaining.slice(matchingTab.length + 1);
                if (!nested[matchingTab]) {
                    nested[matchingTab] = { access: true, kpi: {} };
                }
                
                // If it is Supply tab, handle sub-pages (Prioritize PO, Fix Stock Transfer, Manage Surplus)
                if (matchingTab === 'Supply') {
                    const subPages = ["Prioritize PO", "Fix Stock Transfer", "Manage Surplus"];
                    const matchingSubPage = subPages.find(sp => kpiIdStr.startsWith(sp + '_'));
                    if (matchingSubPage) {
                        const subKpiId = kpiIdStr.slice(matchingSubPage.length + 1);
                        if (!nested[matchingTab].kpi[matchingSubPage]) {
                            nested[matchingTab].kpi[matchingSubPage] = { access: true, kpi: {} };
                        }
                        if (subKpiId === 'access') {
                            nested[matchingTab].kpi[matchingSubPage].access = flatPerms[key];
                        } else {
                            nested[matchingTab].kpi[matchingSubPage].kpi[subKpiId] = flatPerms[key];
                        }
                    } else {
                        nested[matchingTab].kpi[kpiIdStr] = flatPerms[key];
                    }
                } else if (matchingTab === 'Visibility Analysis') {
                    const subPages = ["Share of Shelf", "BSR", "Share Of shelf"];
                    const matchingSubPage = subPages.find(sp => kpiIdStr.toLowerCase().startsWith(sp.toLowerCase() + '_'));
                    if (matchingSubPage) {
                        const subKpiId = kpiIdStr.substring(matchingSubPage.length + 1);
                        // Normalize key to standard capitalization ("Share of Shelf" or "BSR")
                        const normalizedSubPage = matchingSubPage.toLowerCase().startsWith('bsr') ? 'BSR' : 'Share of Shelf';
                        if (!nested[matchingTab].kpi[normalizedSubPage]) {
                            nested[matchingTab].kpi[normalizedSubPage] = { access: true, kpi: {} };
                        }
                        if (subKpiId === 'access') {
                            nested[matchingTab].kpi[normalizedSubPage].access = flatPerms[key];
                        } else {
                            nested[matchingTab].kpi[normalizedSubPage].kpi[subKpiId] = flatPerms[key];
                        }
                    } else {
                        nested[matchingTab].kpi[kpiIdStr] = flatPerms[key];
                    }
                } else {
                    nested[matchingTab].kpi[kpiIdStr] = flatPerms[key];
                }
            } else {
                const lastIdx = remaining.lastIndexOf('_');
                if (lastIdx !== -1) {
                    const tabName = remaining.slice(0, lastIdx);
                    const kpiId = remaining.slice(lastIdx + 1);
                    if (!nested[tabName]) {
                        nested[tabName] = { access: true, kpi: {} };
                    }
                    nested[tabName].kpi[kpiId] = flatPerms[key];
                }
            }
        }
    });
    
    nested.platform = platform;
    return nested;
};

/**
 * Helper to convert nested permissions (e.g. platform: { blinkit: true }) back to flat format:
 * {
 *   "Business Overview": true,
 *   "kpi_Business Overview_offtake": true,
 *   "platform_blinkit": true
 * }
 */
export const toFlatPermissions = (nestedPerms) => {
    if (!nestedPerms) return {};
    const flat = {};
    Object.keys(nestedPerms).forEach(key => {
        if (key === 'platform' && nestedPerms.platform && typeof nestedPerms.platform === 'object') {
            Object.keys(nestedPerms.platform).forEach(plat => {
                flat[`platform_${plat}`] = nestedPerms.platform[plat];
            });
        } else if (nestedPerms[key] && typeof nestedPerms[key] === 'object') {
            // It's a tab with access and KPIs
            flat[key] = nestedPerms[key].access !== undefined ? nestedPerms[key].access : true;
            if (nestedPerms[key].kpi && typeof nestedPerms[key].kpi === 'object') {
                Object.keys(nestedPerms[key].kpi).forEach(kpiId => {
                    const kpiVal = nestedPerms[key].kpi[kpiId];
                    if (kpiVal && typeof kpiVal === 'object') {
                        flat[`kpi_${key}_${kpiId}_access`] = kpiVal.access !== undefined ? kpiVal.access : true;
                        if (kpiVal.kpi && typeof kpiVal.kpi === 'object') {
                            Object.keys(kpiVal.kpi).forEach(subKpiId => {
                                flat[`kpi_${key}_${kpiId}_${subKpiId}`] = kpiVal.kpi[subKpiId];
                            });
                        }
                    } else {
                        flat[`kpi_${key}_${kpiId}`] = kpiVal;
                    }
                });
            }
        } else {
            flat[key] = nestedPerms[key];
        }
    });
    return flat;
};

/**
 * Fetch unique users for the Permissions tab with their latest db_status and tab_permissions
 */
export const getPermissionsUsers = async () => {
    try {
        // Get unique users by email with their latest row's data
        // Use argMaxIf for db_status/tab_permissions to pick latest non-empty value
        const usersQuery = `
            SELECT * FROM (
                SELECT 
                    toString(user_id) as id,
                    user_email as email,
                    user_name as name,
                    user_role as role,
                    toString(db_id) as db_id,
                    if(empty(db_status), 'active', db_status) as db_status,
                    tab_permissions,
                    ip,
                    last_login
                FROM tb_user
                WHERE status != 'deleted'
                ORDER BY last_login DESC
                LIMIT 1 BY user_email
            )
            ORDER BY name ASC
        `;
        const users = await queryAdminDB(usersQuery);

        // Fetch all databases for mapping
        const databasesQuery = `SELECT DISTINCT db_name, toString(db_id) as db_id FROM tb_database`;
        const databases = await queryAdminDB(databasesQuery);

        const dbMap = new Map();
        databases.forEach(db => dbMap.set(db.db_id, db.db_name));

        return users.map(user => {
            let finalDbName = 'N/A';
            if (dbMap.has(user.db_id)) {
                finalDbName = dbMap.get(user.db_id);
            } else {
                // Fuzzy match for BigInt precision
                try {
                    const userDbIdNum = BigInt(user.db_id);
                    let closestDb = null;
                    let closestDiff = BigInt('999999999999999999');
                    for (const [dbId, name] of dbMap.entries()) {
                        const diff = userDbIdNum > BigInt(dbId) ? userDbIdNum - BigInt(dbId) : BigInt(dbId) - userDbIdNum;
                        if (diff < closestDiff) { closestDiff = diff; closestDb = name; }
                    }
                    if (closestDb && closestDiff < BigInt('1000')) finalDbName = closestDb;
                } catch (e) { /* ignore */ }
            }

            // Parse tab_permissions JSON (fallback to empty object)
            let tabPermissions = {};
            try {
                if (user.tab_permissions && user.tab_permissions.trim()) {
                    tabPermissions = toFlatPermissions(JSON.parse(user.tab_permissions));
                }
            } catch (e) { /* ignore parse errors */ }

            return {
                id: user.id.toString(),
                email: user.email,
                name: user.name,
                role: user.role,
                ip: user.ip,
                dbName: finalDbName,
                lastLogin: user.last_login ? new Date(user.last_login).toISOString().replace('T', ' ').split('.')[0] : 'Never',
                dbStatus: (!user.db_status || user.db_status === '' || user.db_status === 'active') ? true : false,
                tabPermissions
            };
        });
    } catch (error) {
        console.error('[AdminService] getPermissionsUsers failed:', error.message);
        throw error;
    }
};

/**
 * Update db_status for a user device (by user_id)
 */
export const updateUserDbStatus = async (userIdOrEmail, dbStatus) => {
    try {
        const statusValue = dbStatus ? 'active' : 'inactive';
        const isEmail = userIdOrEmail.includes('@');
        const query = isEmail ? `
            ALTER TABLE tb_user 
            UPDATE db_status = '${statusValue}' 
            WHERE user_email = '${userIdOrEmail}'
        ` : `
            ALTER TABLE tb_user 
            UPDATE db_status = '${statusValue}' 
            WHERE toString(user_id) = '${userIdOrEmail}'
        `;
        await queryAdminDB(query);
        return { success: true };
    } catch (error) {
        console.error(`[AdminService] updateUserDbStatus failed for ${userIdOrEmail}:`, error.message);
        throw error;
    }
};

/**
 * Update tab_permissions JSON for a user device (by user_id or email)
 */
export const updateUserTabPermissions = async (userIdOrEmail, tabPermissions) => {
    try {
        // 1. Fetch user's db_id
        const isEmail = userIdOrEmail.includes('@');
        const userQuery = isEmail 
            ? `SELECT toString(db_id) as db_id FROM tb_user WHERE user_email = '${userIdOrEmail.replace(/'/g, "\\'")}' LIMIT 1`
            : `SELECT toString(db_id) as db_id FROM tb_user WHERE toString(user_id) = '${userIdOrEmail}' LIMIT 1`;
        const userRows = await queryAdminDB(userQuery);
        
        let cleanedPermissions = { ...tabPermissions };
        
        if (userRows && userRows.length > 0) {
            const dbId = userRows[0].db_id;
            // 2. Fetch db_name from tb_database
            const dbRows = await queryAdminDB(`SELECT db_name FROM tb_database WHERE toString(db_id) = '${dbId}' LIMIT 1`);
            if (dbRows && dbRows.length > 0) {
                const dbName = dbRows[0].db_name;
                // 3. Get active platforms for this database
                const activePlatforms = await getAdminPlatforms(dbName);
                const activePlatformKeys = new Set(activePlatforms.map(p => `platform_${p.toLowerCase()}`));
                
                // 4. Remove all platform_* keys that are not active in this DB
                Object.keys(cleanedPermissions).forEach(key => {
                    if (key.startsWith('platform_') && !activePlatformKeys.has(key)) {
                        delete cleanedPermissions[key];
                    }
                });
            }
        }

        const nestedPermissions = toNestedPermissions(cleanedPermissions);
        const jsonStr = JSON.stringify(nestedPermissions).replace(/'/g, "\\'");
        const query = isEmail ? `
            ALTER TABLE tb_user 
            UPDATE tab_permissions = '${jsonStr}' 
            WHERE user_email = '${userIdOrEmail}'
        ` : `
            ALTER TABLE tb_user 
            UPDATE tab_permissions = '${jsonStr}' 
            WHERE toString(user_id) = '${userIdOrEmail}'
        `;
        await queryAdminDB(query);
        return { success: true };
    } catch (error) {
        console.error(`[AdminService] updateUserTabPermissions failed for ${userIdOrEmail}:`, error.message);
        throw error;
    }
};

/**
 * Fetch available databases from tb_database
 */
export const getDatabases = async () => {
    try {
        const query = `
            SELECT DISTINCT 
                db_name, 
                toString(db_id) as db_id,
                logo_url
            FROM tb_database
            ORDER BY db_name ASC
        `;
        return await queryAdminDB(query);
    } catch (error) {
        console.error('[AdminService] getDatabases failed:', error.message);
        throw error;
    }
};

/**
 * Update the logo_url for a specific database/client
 */
export const updateDatabaseLogo = async (dbId, logoUrl) => {
    try {
        const query = `
            ALTER TABLE tb_database 
            UPDATE logo_url = '${logoUrl.replace(/'/g, "\\'")}' 
            WHERE toString(db_id) = '${dbId}'
        `;
        await queryAdminDB(query);
        return { success: true };
    } catch (error) {
        console.error(`[AdminService] updateDatabaseLogo failed for dbId ${dbId}:`, error.message);
        throw error;
    }
};

/**
 * Create a new user (admin initiated)
 */
export const createUser = async ({ email, password, role, status, db_id }) => {
    try {
        const password_hash = await bcrypt.hash(password, 10);
        
        // Generate an initial user_id based on email because user_name is blank at creation
        const hashRes = await queryAdminDB(`SELECT toString(cityHash64('${email}')) as hash`);
        const user_id = hashRes[0].hash;
        const id = Date.now().toString();
        const currentTimestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        
        await insertAdminDB('tb_user', [{
            id: id,
            user_id: user_id,
            user_email: email,
            user_name: "", 
            user_role: role.toLowerCase(),
            password_hash: password_hash,
            db_id: db_id,
            last_login: currentTimestamp,
            created_on: currentTimestamp,
            status: status.toLowerCase(),
            ip: "", 
            access: "pending",
            db_status: "active",
            tab_permissions: ""
        }]);

        return { success: true, id, user_id };
    } catch (error) {
        console.error('[AdminService] createUser failed:', error.message);
        throw error;
    }
};

/**
 * Save a walkthrough notification to walkthrough_notifications table
 * @param {Object} data - Walkthrough data { title, selectedClients, steps }
 */
export const saveWalkthroughNotification = async ({ title, selectedClients, steps }) => {
    try {
        // Collect ALL unique routes from every step so the walkthrough
        // can be found no matter which step's page the user visits.
        const allRoutes = [...new Set(steps.map(s => s.route).filter(Boolean))];
        const page_route = allRoutes.join(',');

        const notification_json = JSON.stringify(steps).replace(/'/g, "\\'");
        
        await insertAdminDB('walkthrough_notifications', [{
            update_title: title,
            target_clients: selectedClients,
            page_route: page_route,
            notification_json: notification_json
        }]);

        return { success: true };
    } catch (error) {
        console.error('[AdminService] saveWalkthroughNotification failed:', error.message);
        throw error;
    }
};

/**
 * Create a new database in tb_database
 */
export const createDatabase = async (dbName) => {
    try {
        const safeDbName = dbName.replace(/'/g, "\\'").trim();
        // Check if database already exists
        const existsQuery = `
            SELECT 1 FROM tb_database 
            WHERE lower(db_name) = '${safeDbName.toLowerCase()}'
            LIMIT 1
        `;
        const exists = await queryAdminDB(existsQuery);
        if (exists.length > 0) {
            throw new Error(`Database "${dbName}" already exists`);
        }

        // Insert using ClickHouse native UUID and cityHash64 generation
        const query = `
            INSERT INTO tb_database (id, db_id, db_name, created_on, status)
            SELECT 
                cityHash64(toString(generateUUIDv4())), 
                cityHash64('${safeDbName}'), 
                '${safeDbName}', 
                now(), 
                'active'
        `;
        await queryAdminDB(query);
        return { success: true };
    } catch (error) {
        console.error(`[AdminService] createDatabase failed for ${dbName}:`, error.message);
        throw error;
    }
};

const dbPlatformsCache = new Map();
export const clearDbPlatformsCache = () => {
    dbPlatformsCache.clear();
    console.log("🧹 [Cache Clear] Cleared dbPlatformsCache completely");
};
const PLATFORMS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch unique active platforms from ClickHouse rb_platform table for a specific database
 */
export const getAdminPlatforms = async (dbName) => {
    const db = (dbName || 'mars').trim().toLowerCase();
    
    // Check in-memory cache
    const cached = dbPlatformsCache.get(db);
    if (cached && (Date.now() - cached.timestamp) < PLATFORMS_CACHE_TTL) {
        return cached.data;
    }

    try {
        const checkQuery = `EXISTS TABLE ${db}.rb_platform`;
        const existsRes = await queryAdminDB(checkQuery);
        if (existsRes && existsRes[0] && existsRes[0].result === 1) {
            const query = `
                SELECT DISTINCT pf_name 
                FROM ${db}.rb_platform 
                WHERE status = 1 
                ORDER BY pf_name ASC
            `;
            const result = await queryAdminDB(query);
            if (result && result.length > 0) {
                const platforms = result.map(row => row.pf_name.toLowerCase());
                dbPlatformsCache.set(db, { data: platforms, timestamp: Date.now() });
                return platforms;
            }
        }
        const fallback = ["amazon", "flipkart", "bigbasket", "blinkit", "instamart", "zepto", "dmart"];
        dbPlatformsCache.set(db, { data: fallback, timestamp: Date.now() });
        return fallback;
    } catch (error) {
        console.error(`[AdminService] getAdminPlatforms failed for ${db}:`, error.message);
        const fallback = ["amazon", "flipkart", "bigbasket", "blinkit", "instamart", "zepto", "dmart"];
        return fallback;
    }
};

/**
 * Helper to update flat KPI key under the correct nested structure inside perms JSON
 */
const setNestedKpiValue = (perms, page, kpiId, value) => {
    if (!perms[page]) {
        perms[page] = { access: true, kpi: {} };
    } else if (typeof perms[page] === 'boolean') {
        perms[page] = { access: perms[page], kpi: {} };
    }

    if (!perms[page].kpi) {
        perms[page].kpi = {};
    }

    if (page === 'Supply') {
        const subPages = ["Prioritize PO", "Fix Stock Transfer", "Manage Surplus"];
        const matchingSubPage = subPages.find(sp => kpiId.startsWith(sp + '_'));
        if (matchingSubPage) {
            const subKpiId = kpiId.slice(matchingSubPage.length + 1);
            if (!perms[page].kpi[matchingSubPage]) {
                perms[page].kpi[matchingSubPage] = { access: true, kpi: {} };
            } else if (typeof perms[page].kpi[matchingSubPage] === 'boolean') {
                perms[page].kpi[matchingSubPage] = { access: perms[page].kpi[matchingSubPage], kpi: {} };
            }
            if (subKpiId === 'access') {
                perms[page].kpi[matchingSubPage].access = value;
            } else {
                if (!perms[page].kpi[matchingSubPage].kpi) {
                    perms[page].kpi[matchingSubPage].kpi = {};
                }
                perms[page].kpi[matchingSubPage].kpi[subKpiId] = value;
            }
            return;
        }
    } else if (page === 'Visibility Analysis') {
        const subPages = ["Share of Shelf", "BSR", "Share Of shelf"];
        const matchingSubPage = subPages.find(sp => kpiId.toLowerCase().startsWith(sp.toLowerCase() + '_'));
        if (matchingSubPage) {
            const subKpiId = kpiId.substring(matchingSubPage.length + 1);
            const normalizedSubPage = matchingSubPage.toLowerCase().startsWith('bsr') ? 'BSR' : 'Share of Shelf';
            if (!perms[page].kpi[normalizedSubPage]) {
                perms[page].kpi[normalizedSubPage] = { access: true, kpi: {} };
            } else if (typeof perms[page].kpi[normalizedSubPage] === 'boolean') {
                perms[page].kpi[normalizedSubPage] = { access: perms[page].kpi[normalizedSubPage], kpi: {} };
            }
            if (subKpiId === 'access') {
                perms[page].kpi[normalizedSubPage].access = value;
            } else {
                if (!perms[page].kpi[normalizedSubPage].kpi) {
                    perms[page].kpi[normalizedSubPage].kpi = {};
                }
                perms[page].kpi[normalizedSubPage].kpi[subKpiId] = value;
            }
            return;
        }
    }

    // Default: flat KPI mapping
    perms[page].kpi[kpiId] = value;
};

/**
 * Update KPI permissions database-wide for all users of a selected database
 */
export const updateKpiPermissionsBatch = async (dbName, page, kpis) => {
    try {
        // 1. Resolve db_id from dbName
        const dbRows = await queryAdminDB(`
            SELECT DISTINCT toString(db_id) as db_id 
            FROM tb_database 
            WHERE lower(db_name) = '${dbName.toLowerCase().trim()}'
        `);
        if (dbRows.length === 0) {
            throw new Error(`Database "${dbName}" not found`);
        }
        const dbId = dbRows[0].db_id;
        const targetDbIdNum = BigInt(dbId);

        // 2. Fetch all unique users and filter them using BigInt approximate check (within 1000)
        const allUserRows = await queryAdminDB(`
            SELECT 
                user_email, 
                ifNull(argMaxIf(tab_permissions, last_login, tab_permissions != ''), '') as tab_permissions,
                toString(argMax(db_id, last_login)) as db_id_str
            FROM tb_user 
            GROUP BY user_email
        `);

        const userRows = allUserRows.filter(user => {
            if (!user.db_id_str) return false;
            try {
                const userDbIdNum = BigInt(user.db_id_str);
                const diff = targetDbIdNum > userDbIdNum ? targetDbIdNum - userDbIdNum : userDbIdNum - targetDbIdNum;
                return diff < BigInt('1000');
            } catch (e) {
                return false;
            }
        });

        // 3. Update permissions for each user
        for (const user of userRows) {
            let perms = {};
            if (user.tab_permissions && user.tab_permissions.trim()) {
                try {
                    perms = JSON.parse(user.tab_permissions);
                } catch (_) {}
            }

            // Merge KPI updates using the helper
            Object.keys(kpis).forEach(kpiId => {
                setNestedKpiValue(perms, page, kpiId, kpis[kpiId]);
            });

            const jsonStr = JSON.stringify(perms).replace(/'/g, "\\'");
            await queryAdminDB(`
                ALTER TABLE tb_user 
                UPDATE tab_permissions = '${jsonStr}' 
                WHERE user_email = '${user.user_email.replace(/'/g, "\\'")}'
            `);
        }

        return { success: true };
    } catch (error) {
        console.error('[AdminService] updateKpiPermissionsBatch failed:', error.message);
        throw error;
    }
};

/**
 * Update KPI permissions for a single user
 */
export const updateUserKpiPermissions = async (email, page, kpis) => {
    try {
        // Fetch the user's tab_permissions
        const userRows = await queryAdminDB(`
            SELECT user_email, tab_permissions 
            FROM tb_user 
            WHERE user_email = '${email.replace(/'/g, "\\'")}'
            LIMIT 1
        `);

        if (userRows.length === 0) {
            throw new Error(`User "${email}" not found`);
        }

        const user = userRows[0];
        let perms = {};
        if (user.tab_permissions && user.tab_permissions.trim()) {
            try {
                perms = JSON.parse(user.tab_permissions);
            } catch (_) {}
        }

        // Merge KPI updates using the helper
        Object.keys(kpis).forEach(kpiId => {
            setNestedKpiValue(perms, page, kpiId, kpis[kpiId]);
        });

        const jsonStr = JSON.stringify(perms).replace(/'/g, "\\'");
        await queryAdminDB(`
            ALTER TABLE tb_user 
            UPDATE tab_permissions = '${jsonStr}' 
            WHERE user_email = '${user.user_email.replace(/'/g, "\\'")}'
        `);

        return { success: true };
    } catch (error) {
        console.error('[AdminService] updateUserKpiPermissions failed:', error.message);
        throw error;
    }
};

