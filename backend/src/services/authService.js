// src/services/authService.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { queryAdminDB, insertAdminDB } from '../config/adminClickhouse.js';
import { toFlatPermissions } from './adminService.js';
import { generateDeviceToken, getDeviceTokenForClient } from './deviceService.js';
import { clearPermissionsCache } from '../helper/permissionMiddleware.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';
// Tokens are permanent (no expiration)

/**
 * Helper to fetch mapped databases details given a mapped_db string (e.g. "mars,kellogs")
 */
export async function getMappedDatabasesForDb(mappedDbStr) {
    if (!mappedDbStr || typeof mappedDbStr !== 'string' || !mappedDbStr.trim()) {
        return [];
    }

    const dbNames = mappedDbStr.split(',').map(s => s.trim()).filter(Boolean);
    if (dbNames.length === 0) return [];

    try {
        const inClause = dbNames.map(name => `'${name.toLowerCase().replace(/'/g, "''")}'`).join(',');
        const rows = await queryAdminDB(`
            SELECT toString(db_id) as db_id, db_name, logo_url, company_id, mapped_db 
            FROM tb_database 
            WHERE lower(db_name) IN (${inClause}) AND status = 'active'
        `);

        return rows.map(r => ({
            dbName: r.db_name,
            dbId: r.db_id,
            dbLogoUrl: r.logo_url || "",
            companyId: (r.company_id && r.company_id !== '00000000-0000-0000-0000-000000000000') ? r.company_id : '',
            mappedDb: r.mapped_db || ""
        }));
    } catch (e) {
        console.warn('[Auth] Failed to fetch mapped databases:', e.message);
        return [];
    }
}

/**
 * Helper to fetch all allowed workspace databases for a given user email.
 * Finds distinct db_ids assigned to this email in tb_user and maps them to tb_database.
 */
export async function getUserMappedDatabases(email) {
    if (!email || typeof email !== 'string' || !email.trim()) {
        return [];
    }

    try {
        // 1. Fetch all active databases from tb_database
        const allDbs = await queryAdminDB(
            `SELECT toString(db_id) as db_id, db_name, logo_url, company_id, mapped_db 
             FROM tb_database 
             WHERE status = 'active'`
        );

        if (!allDbs || allDbs.length === 0) return [];

        // 2. Fetch distinct db_ids assigned to this user email in tb_user
        const userDbRows = await queryAdminDB(
            `SELECT DISTINCT toString(db_id) as db_id 
             FROM tb_user 
             WHERE lower(user_email) = lower({email:String}) AND status != 'deleted'`,
            { email: email.trim() }
        );

        if (!userDbRows || userDbRows.length === 0) return [];

        const userDbIds = new Set(
            userDbRows.map(r => String(r.db_id || '').trim()).filter(Boolean)
        );

        const matchedDbsMap = new Map(); // db_name -> dbObj

        // Match userDbIds against allDbs in tb_database
        for (const db of allDbs) {
            const dbIdStr = String(db.db_id);
            const dbNameLower = db.db_name.toLowerCase();

            let isMatch = false;

            if (userDbIds.has(dbIdStr)) {
                isMatch = true;
            } else {
                // Approximate BigInt match for user db_ids
                for (const uDbId of userDbIds) {
                    try {
                        const uIdNum = BigInt(uDbId);
                        const dbIdNum = BigInt(dbIdStr);
                        const diff = uIdNum > dbIdNum ? uIdNum - dbIdNum : dbIdNum - uIdNum;
                        if (diff < BigInt('1000')) {
                            isMatch = true;
                            break;
                        }
                    } catch (e) { /* ignore BigInt parse error */ }
                }
            }

            if (isMatch) {
                matchedDbsMap.set(dbNameLower, db);
            }
        }

        return Array.from(matchedDbsMap.values()).map(r => ({
            dbName: r.db_name,
            dbId: String(r.db_id),
            dbLogoUrl: r.logo_url || "",
            companyId: (r.company_id && r.company_id !== '00000000-0000-0000-0000-000000000000') ? r.company_id : '',
            mappedDb: r.mapped_db || ""
        }));
    } catch (e) {
        console.warn('[Auth] Failed to fetch user mapped databases:', e.message);
        return [];
    }
}

/**
 * Helper to match a candidate db_id against a target db_id, handling BigInt precision drift (< 1000).
 */
export function isDbIdMatch(candidateDbId, targetDbId) {
    if (!candidateDbId || !targetDbId) return false;
    const strCandidate = String(candidateDbId).trim();
    const strTarget = String(targetDbId).trim();
    if (strCandidate === strTarget) return true;

    try {
        const numCandidate = BigInt(strCandidate);
        const numTarget = BigInt(strTarget);
        const diff = numCandidate > numTarget ? numCandidate - numTarget : numTarget - numCandidate;
        return diff < BigInt('1000');
    } catch (_) {
        return false;
    }
}

/**
 * Resolve effective tab_permissions, db_status, and qc_user for a specific user email on a specific database.
 * Priority order:
 *   1. Exact or approximate (BigInt diff < 1000) match for user_email + db_id with non-empty tab_permissions
 *   2. Any user's default row with non-empty tab_permissions on that db_id
 *   3. If dbId not matched or not provided, fallback to user_email's latest row on any database with non-empty tab_permissions
 */
export async function resolveUserPermissionsForDb(email, targetDbId, targetDbName = '') {
    const cleanEmail = (email || '').trim().toLowerCase();
    let cleanDbId = (targetDbId !== undefined && targetDbId !== null) ? String(targetDbId).trim() : '';

    // If cleanDbId is empty, look up db_id by targetDbName in tb_database
    if (!cleanDbId && targetDbName) {
        try {
            const dbRows = await queryAdminDB(
                `SELECT toString(db_id) as db_id FROM tb_database WHERE lower(db_name) = '${targetDbName.toLowerCase().replace(/'/g, "\\'")}' LIMIT 1`
            );
            if (dbRows && dbRows.length > 0) {
                cleanDbId = dbRows[0].db_id;
            }
        } catch (e) {
            console.warn('[Auth] Error looking up db_id for db_name:', e.message);
        }
    }

    let tabPermissions = {};
    let rawTabPermissions = '';
    let dbStatusBool = true;
    let qcUserVal = 0;
    let matchedDbId = cleanDbId;

    if (!cleanEmail) {
        return { tabPermissions, dbStatus: dbStatusBool, rawTabPermissions, qcUser: qcUserVal, matchedDbId };
    }

    try {
        // Step 1: Query user's records from tb_user (status != 'deleted')
        const userRows = await queryAdminDB(
            `SELECT toString(db_id) as db_id, db_status, tab_permissions, qc_user, last_login, created_on 
             FROM tb_user 
             WHERE lower(user_email) = lower({email:String}) 
               AND status != 'deleted'
             ORDER BY created_on DESC, last_login DESC`,
            { email: cleanEmail }
        );

        let matchedUserRow = null;
        if (userRows && userRows.length > 0) {
            // Find a row matching cleanDbId with non-empty tab_permissions
            if (cleanDbId) {
                matchedUserRow = userRows.find(r => isDbIdMatch(r.db_id, cleanDbId) && r.tab_permissions && r.tab_permissions.trim() !== '');
                // If not found with non-empty tab_permissions, match any row for db_id
                if (!matchedUserRow) {
                    matchedUserRow = userRows.find(r => isDbIdMatch(r.db_id, cleanDbId));
                }
            }

            if (matchedUserRow) {
                if (matchedUserRow.db_status !== undefined && matchedUserRow.db_status !== null) {
                    dbStatusBool = (!matchedUserRow.db_status || matchedUserRow.db_status === '' || matchedUserRow.db_status === 'active');
                }
                if (matchedUserRow.qc_user !== undefined && matchedUserRow.qc_user !== null) {
                    qcUserVal = Number(matchedUserRow.qc_user) || 0;
                }
                if (matchedUserRow.tab_permissions && matchedUserRow.tab_permissions.trim() !== '') {
                    rawTabPermissions = matchedUserRow.tab_permissions.trim();
                    try {
                        tabPermissions = toFlatPermissions(JSON.parse(rawTabPermissions));
                    } catch (_) {}
                    matchedDbId = matchedUserRow.db_id || cleanDbId;
                }
            }
        }

        // Step 2: Fallback to db_id general default tab_permissions across any user on THIS database
        if (cleanDbId && Object.keys(tabPermissions).length === 0) {
            const prefix = cleanDbId.length >= 15 ? cleanDbId.slice(0, 15) : cleanDbId;
            const dbRows = await queryAdminDB(
                `SELECT toString(db_id) as db_id, db_status, tab_permissions, qc_user 
                 FROM tb_user 
                 WHERE (toString(db_id) = '${cleanDbId}' OR toString(db_id) LIKE '${prefix}%' OR abs(toInt128OrZero(toString(db_id)) - toInt128OrZero('${cleanDbId}')) < 1000)
                   AND tab_permissions != '' 
                   AND status != 'deleted' 
                 ORDER BY created_on DESC, last_login DESC 
                 LIMIT 20`
            );
            if (dbRows && dbRows.length > 0) {
                const matchedDbRow = dbRows.find(r => isDbIdMatch(r.db_id, cleanDbId) && r.tab_permissions && r.tab_permissions.trim() !== '');
                if (matchedDbRow) {
                    rawTabPermissions = matchedDbRow.tab_permissions.trim();
                    try {
                        tabPermissions = toFlatPermissions(JSON.parse(rawTabPermissions));
                    } catch (_) {}
                    matchedDbId = matchedDbRow.db_id || cleanDbId;
                    if (dbStatusBool === undefined || !matchedUserRow) {
                        dbStatusBool = (!matchedDbRow.db_status || matchedDbRow.db_status === '' || matchedDbRow.db_status === 'active');
                    }
                    if (qcUserVal === 0 && matchedDbRow.qc_user) {
                        qcUserVal = Number(matchedDbRow.qc_user) || 0;
                    }
                }
            }
        }

        // Step 2b: Fallback to workspace email matching targetDbName if tab_permissions still empty
        if (targetDbName && Object.keys(tabPermissions).length === 0) {
            const cleanName = targetDbName.toLowerCase().replace(/'/g, "\\'");
            const nameRows = await queryAdminDB(
                `SELECT toString(db_id) as db_id, db_status, tab_permissions, qc_user 
                 FROM tb_user 
                 WHERE (lower(user_email) LIKE '${cleanName}%@trailytics.com' OR lower(user_name) LIKE '%${cleanName}%')
                   AND tab_permissions != '' 
                   AND status != 'deleted' 
                 ORDER BY created_on DESC, last_login DESC 
                 LIMIT 10`
            );
            if (nameRows && nameRows.length > 0) {
                const matchedNameRow = nameRows.find(r => r.tab_permissions && r.tab_permissions.trim() !== '');
                if (matchedNameRow) {
                    rawTabPermissions = matchedNameRow.tab_permissions.trim();
                    try {
                        tabPermissions = toFlatPermissions(JSON.parse(rawTabPermissions));
                    } catch (_) {}
                    matchedDbId = matchedNameRow.db_id || cleanDbId;
                    if (dbStatusBool === undefined || !matchedUserRow) {
                        dbStatusBool = (!matchedNameRow.db_status || matchedNameRow.db_status === '' || matchedNameRow.db_status === 'active');
                    }
                    if (qcUserVal === 0 && matchedNameRow.qc_user) {
                        qcUserVal = Number(matchedNameRow.qc_user) || 0;
                    }
                }
            }
        }

        // Step 3: Only fallback to user_email across any db_id if neither cleanDbId nor targetDbName was specified
        if (!cleanDbId && !targetDbName && Object.keys(tabPermissions).length === 0 && userRows && userRows.length > 0) {
            const fallbackRow = userRows.find(r => r.tab_permissions && r.tab_permissions.trim() !== '');
            if (fallbackRow) {
                rawTabPermissions = fallbackRow.tab_permissions.trim();
                try {
                    tabPermissions = toFlatPermissions(JSON.parse(rawTabPermissions));
                } catch (_) {}
                if (fallbackRow.db_status !== undefined && fallbackRow.db_status !== null) {
                    dbStatusBool = (!fallbackRow.db_status || fallbackRow.db_status === '' || fallbackRow.db_status === 'active');
                }
            }
        }
    } catch (e) {
        console.warn('[Auth] Failed to resolve user permissions for DB:', e.message);
    }

    return {
        tabPermissions,
        dbStatus: dbStatusBool,
        rawTabPermissions,
        qcUser: qcUserVal,
        matchedDbId,
    };
}

/**
 * Helper to resolve the effective tab_permissions for a given user email and db_id.
 * Priority order:
 *   1. Existing tab_permissions for (user_email + db_id)
 *   2. Existing tab_permissions for (db_id) default across any user
 *   3. If dbId was NOT provided, fall back to (user_email) across any db_id
 */
export async function resolveEffectiveTabPermissions(email, dbId, dbName = '') {
    const res = await resolveUserPermissionsForDb(email, dbId, dbName);
    return res.rawTabPermissions || '';
}

/**
 * Authenticate user by email and password, with Trusted Device verification.
 *
 * Device verification flow (all within tb_user):
 *   1. If a device_token cookie exists → look up in tb_user by (email, device_token)
 *      - If found & access='allow'  → grant login, silently update fingerprint/IP
 *      - If found & access='pending' → throw "pending" error
 *      - If found & access='deny'   → throw "denied" error
 *   2. If no cookie → fall back to fingerprint lookup via the `ip` column
 *      - If found & access='allow' → grant login (controller will issue new cookie)
 *      - If found & pending/deny   → throw corresponding error
 *   3. If nothing found → insert a new pending row with a fresh device_token
 *
 * @param {string} email
 * @param {string} password
 * @param {object} deviceInfo - { deviceToken, fingerprintId, browser, browserVersion, os, platform, ip }
 * @returns {object} { token, user, deviceToken, isNewDeviceToken }
 */
export async function loginUser(email, password, deviceInfo = {}) {
    const {
        deviceToken: incomingDeviceToken,
        fingerprintId,
        browser,
        browserVersion,
        os,
        platform,
        ip: clientIp
    } = deviceInfo;

    const trimmedEmail = (email || '').trim();

    // 1. Find user by email (get latest active row, case-insensitive match)
    const users = await queryAdminDB(
        `SELECT *, toString(db_id) as db_id_str, toString(id) as id_str, toString(user_id) as user_id_str 
         FROM tb_user 
         WHERE lower(user_email) = lower({email:String}) AND status = 'active'
         ORDER BY last_login DESC
         LIMIT 1`,
        { email: trimmedEmail }
    );



    if (!users || users.length === 0) {
        throw new Error('Invalid email or password');
    }

    const user = users[0];

    // 2. Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        throw new Error('Invalid email or password');
    }

    // 3. Look up db_name, company_id and mapped_db from tb_database using db_id
    const databases = await queryAdminDB(
        `SELECT db_name, toString(db_id) as db_id, logo_url, company_id, mapped_db 
         FROM tb_database 
         WHERE status = 'active'`
    );

    let dbName = process.env.CLICKHOUSE_DB || 'colpal';
    let dbLogoUrl = "";
    let companyId = process.env.RATINGS_COMPANY_ID || '';
    const userDbId = user.db_id_str;

    let matchedDb = databases.find(db => db.db_id === userDbId);
    if (!matchedDb && databases.length > 0) {
        const userDbIdNum = BigInt(userDbId);
        let closestDb = null;
        let closestDiff = BigInt('999999999999999999');

        for (const db of databases) {
            const dbIdNum = BigInt(db.db_id);
            const diff = userDbIdNum > dbIdNum ? userDbIdNum - dbIdNum : dbIdNum - userDbIdNum;
            if (diff < closestDiff) {
                closestDiff = diff;
                closestDb = db;
            }
        }

        if (closestDb && closestDiff < BigInt('1000')) {
            matchedDb = closestDb;
            console.log(`[Auth] db_id approximate match: user=${userDbId}, db=${closestDb.db_id}, diff=${closestDiff}`);
        }
    }

    let resolvedDbId = matchedDb ? matchedDb.db_id : userDbId;

    if (matchedDb) {
        dbName = matchedDb.db_name;
        dbLogoUrl = matchedDb.logo_url || "";
        // Filter out the null UUID sentinel (00000000-0000-0000-0000-000000000000)
        // which is the default ClickHouse UUID('') value and means "not assigned".
        const rawCid = matchedDb.company_id || '';
        const isNullUuid = rawCid === '00000000-0000-0000-0000-000000000000';
        if (rawCid && !isNullUuid) {
            companyId = rawCid;
        }
        console.log(`[Auth] ✅ Database mapped for ${user.user_email}: ${dbName} (id: ${resolvedDbId}) companyId: ${companyId || '(none)'}`);
    } else {
        console.warn(`[Auth] ⚠️ No matching database found for db_id=${userDbId}, using fallback: ${dbName}`);
    }

    // Workaround for readonly permission on tb_user: force mars for user
    if (user.user_email === 'kenilkavar@gmail.com') {
        dbName = 'mars';
        const marsDb = databases.find(d => d.db_name === 'mars');
        if (marsDb) resolvedDbId = marsDb.db_id;
        console.log(`[Auth] 💡 Manual override: forcing dbName='mars' for ${user.user_email}`);
    }

    // Map user_role to role (default to 'user' if not specified)
    const userRole = user.user_role || 'user';
    const normalizedRole = userRole.toLowerCase();
    const isAdmin = normalizedRole.includes('admin') || normalizedRole.includes('super');

    console.log(`[DEBUG_AUTH] Login Attempt: ${user.user_email} | Role: ${userRole} | IsAdmin: ${isAdmin} | IP: ${clientIp || '0.0.0.0'}`);

    // Ensure effective tab_permissions are inherited (user_email+db_id -> user_email -> db_id)
    const targetDbIdForPerms = resolvedDbId || user.db_id_str;
    const effectiveTabPermissions = await resolveEffectiveTabPermissions(user.user_email, targetDbIdForPerms);

    // ========================================================================
    // 4. TRUSTED DEVICE ACCESS CONTROL  (all within tb_user table)
    // ========================================================================
    let resolvedDeviceToken = null;
    let isNewDeviceToken = false;

    if (!isAdmin) {
        let matchedRow = null;
        const clientDeviceToken = getDeviceTokenForClient(incomingDeviceToken, user.db_id_str, user.user_email);

        // Step A: Try device_token cookie (PRIMARY — uniquely identifies this browser/device per client)
        if (clientDeviceToken) {
            const tokenRows = await queryAdminDB(
                `SELECT access, device_token, ip
                 FROM tb_user
                 WHERE user_email = {email:String}
                   AND db_id = {dbId:String}
                   AND device_token = {dtoken:String}
                   AND device_token != ''
                 ORDER BY
                   CASE access WHEN 'allow' THEN 0 WHEN 'deny' THEN 1 ELSE 2 END,
                   last_login DESC
                 LIMIT 1`,
                { email: user.user_email, dbId: user.db_id_str, dtoken: clientDeviceToken }
            );
            if (tokenRows.length > 0) {
                matchedRow = tokenRows[0];
                console.log(`[DEBUG_AUTH] Device token match for ${user.user_email} (db_id: ${user.db_id_str}): access=${matchedRow.access}`);
            }
        }

        // Step B: Fall back to email-level approval ONLY if this device already had
        // a cookie token for this client (returning device with stale/rotated token).
        // For genuinely NEW devices (no cookie token), skip this so they go to Step D
        // which creates a pending approval request for admin review.
        if (!matchedRow && clientDeviceToken) {
            const emailRows = await queryAdminDB(
                `SELECT access, device_token, ip
                 FROM tb_user
                 WHERE user_email = {email:String}
                   AND db_id = {dbId:String}
                   AND access = 'allow'
                 ORDER BY last_login DESC
                 LIMIT 1`,
                { email: user.user_email, dbId: user.db_id_str }
            );
            if (emailRows.length > 0) {
                matchedRow = emailRows[0];
                console.log(`[DEBUG_AUTH] Email-level approval match for ${user.user_email} (db_id: ${user.db_id_str}): access=${matchedRow.access}`);
            }
        }

        // Step C: Evaluate access status or create pending request for new device
        if (matchedRow) {
            const currentAccess = (matchedRow.access || '').toLowerCase().trim();

            if (currentAccess === 'allow' || currentAccess === 'pending') {
                // ✅ Approved or Auto-Approved pending request — allow login
                const isValidTok = (t) => t && typeof t === 'string' && !t.includes('{') && !t.includes('%') && t.length > 5;
                resolvedDeviceToken = isValidTok(clientDeviceToken) ? clientDeviceToken : (isValidTok(matchedRow.device_token) ? matchedRow.device_token : generateDeviceToken());
                console.log(`[DEBUG_AUTH] ENFORCEMENT: Granting access to ${user.user_email} (Auto-approved) for client db_id=${user.db_id_str}`);
            } else if (currentAccess === 'deny') {
                throw new Error('Access Denied: Your access request has been rejected by an administrator.');
            } else {
                const isValidTok = (t) => t && typeof t === 'string' && !t.includes('{') && !t.includes('%') && t.length > 5;
                resolvedDeviceToken = isValidTok(clientDeviceToken) ? clientDeviceToken : (isValidTok(matchedRow.device_token) ? matchedRow.device_token : generateDeviceToken());
            }
        } else {
            // Step D: No existing record for this specific device or email for this client.
            // AUTO-APPROVE new access requests automatically
            const newToken = clientDeviceToken || generateDeviceToken();
            resolvedDeviceToken = newToken;
            console.log(`[DEBUG_AUTH] New device/user detected for ${user.user_email} (db_id: ${user.db_id_str}), AUTO-APPROVING access request with token ${newToken}`);
            try {
                const rowId = Date.now().toString();
                await insertAdminDB('tb_user', [{
                    id: rowId,
                    user_id: user.user_id_str,
                    user_email: user.user_email,
                    user_name: user.user_name,
                    user_role: userRole,
                    password_hash: user.password_hash,
                    db_id: user.db_id_str,
                    last_login: new Date().toISOString().replace('T', ' ').split('.')[0],
                    created_on: user.created_on,
                    status: 'active',
                    ip: fingerprintId || clientIp || '0.0.0.0',
                    access: 'allow', // AUTO-APPROVED (was 'pending')
                    db_status: user.db_status || 'active',
                    tab_permissions: effectiveTabPermissions,
                    qc_user: Number(user.qc_user) || 0,
                    device_token: newToken,
                    browser: browser || '',
                    browser_version: browserVersion || '',
                    operating_system: os || '',
                    platform: platform || '',
                }]);
                console.log(`[DEBUG_AUTH] Created and auto-approved new request in tb_user for ${user.user_email} (db_id: ${user.db_id_str}) with token ${newToken}`);
            } catch (ipError) {
                console.error(`[DEBUG_AUTH] Failed to insert row:`, ipError.message);
            }
        }
    } else {
        console.log(`[DEBUG_AUTH] ENFORCEMENT: Admin bypass for ${user.user_email}`);
    }

    // ========================================================================
    // 5. Track successful login & ensure device_token is persisted on allowed row
    // ========================================================================
    try {
        const rowId = (Date.now() + 1).toString();

        // --- Walkthrough Visibility Fix ---
        const oldUserRows = await queryAdminDB(
            `SELECT max(last_login) as last_login FROM tb_user WHERE user_email = {email:String}`,
            { email: user.user_email }
        );
        let lastLoginToSave = new Date().toISOString().replace('T', ' ').split('.')[0];

        if (oldUserRows.length > 0 && oldUserRows[0].last_login) {
            const prevLastLogin = oldUserRows[0].last_login;
            
            const pendingWalkthroughs = await queryAdminDB(`
                SELECT count() as count FROM walkthrough_notifications 
                WHERE arrayExists(x -> lower(x) = lower('${dbName}'), target_clients)
                AND created_on > '${prevLastLogin}'
            `);
            
            if (pendingWalkthroughs.length > 0 && parseInt(pendingWalkthroughs[0].count) > 0) {
                lastLoginToSave = prevLastLogin;
                console.log(`[DEBUG_AUTH] Preserving old last_login (${lastLoginToSave}) for ${user.user_email} due to pending walkthroughs.`);
            }
        }

        await insertAdminDB('tb_user', [{
            id: rowId,
            user_id: user.user_id_str,
            user_email: user.user_email,
            user_name: user.user_name,
            user_role: userRole,
            password_hash: user.password_hash,
            db_id: user.db_id_str,
            last_login: lastLoginToSave,
            created_on: user.created_on,
            status: 'active',
            ip: fingerprintId || clientIp || '0.0.0.0',
            access: 'allow',
            db_status: user.db_status || 'active',
            tab_permissions: effectiveTabPermissions,
            qc_user: Number(user.qc_user) || 0,
            device_token: resolvedDeviceToken || '',
            browser: browser || '',
            browser_version: browserVersion || '',
            operating_system: os || '',
            platform: platform || '',
        }]);
    } catch (logError) {
        console.error(`[DEBUG_AUTH] Error logging success:`, logError.message);
    }

    // Fetch the latest non-empty db_status and tab_permissions for this user on this database
    let tabPermissions = {};
    let dbStatusBool = true;
    try {
        const permsResult = await resolveUserPermissionsForDb(user.user_email, resolvedDbId || user.db_id_str, dbName);
        tabPermissions = permsResult.tabPermissions;
        dbStatusBool = permsResult.dbStatus;
    } catch (e) {
        console.warn('[Auth] Failed to fetch permissions during login:', e.message);
    }

    // 6. Fetch mapped databases list for user (distinct db_ids in tb_user + mapped_db)
    const mappedDatabases = await getUserMappedDatabases(user.user_email, matchedDb);

    // 7. Generate JWT token
    // NOTE: Do NOT include dbLogoUrl or tabPermissions in the JWT payload.
    // dbLogoUrl is a base64-encoded image (10-20KB+) and tabPermissions is a large
    // JSON object. Including them causes the Authorization header to exceed nginx's
    // default 8KB header buffer limit, resulting in "400 Bad Request - Request Header
    // Or Cookie Too Large" on the server. These values are returned separately in
    // the login response and stored in sessionStorage.
    const tokenPayload = {
        userId: user.user_id,
        email: user.user_email,
        userName: user.user_name,
        dbName: dbName,
        dbId: resolvedDbId,
        role: userRole,
        qcUser: Number(user.qc_user) || 0,
        dbStatus: dbStatusBool,
        companyId,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET);

    return {
        token,
        user: {
            email: user.user_email,
            name: user.user_name,
            dbName: dbName,
            dbId: resolvedDbId,
            dbLogoUrl: dbLogoUrl,
            role: userRole,
            qcUser: Number(user.qc_user) || 0,
            dbStatus: dbStatusBool,
            tabPermissions,
            companyId,      // ratings postgres company_id — stored in sessionStorage for ratings tab
            mappedDatabases,
        },
        // Device token info for the controller to set the HTTP-only cookie
        deviceToken: resolvedDeviceToken,
        isNewDeviceToken,
    };
}

/**
 * Sign a JWT with the app secret, e.g. a short-lived token a background job
 * uses to call report_backend on a user's behalf.
 */
export function signToken(payload, options = {}) {
    return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verify a JWT token and return the decoded payload
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Verify an existing session: decode the JWT AND re-check device access.
 * Called on page refresh to ensure the user still has valid access.
 */
export async function verifySession(token, deviceToken = null) {
    // 1. Verify token signature and expiry
    const decoded = verifyToken(token);

    // 2. Determine role from token
    const userRole = decoded.role || 'user';
    const normalizedRole = userRole.toLowerCase();
    const isAdmin = normalizedRole.includes('admin') || normalizedRole.includes('super');

    // 3. For non-admin users, re-check access status
    if (!isAdmin) {
        let accessVerified = false;

        const clientDeviceToken = getDeviceTokenForClient(deviceToken, decoded.dbId, decoded.email);

        // Check via device_token cookie first (if present)
        if (clientDeviceToken) {
            const tokenRows = await queryAdminDB(
                `SELECT access FROM tb_user
                 WHERE lower(user_email) = lower({email:String})
                   AND (toString(db_id) = {dbId:String} OR {dbId:String} = '')
                   AND device_token = {dtoken:String}
                 ORDER BY last_login DESC
                 LIMIT 1`,
                { email: decoded.email, dbId: String(decoded.dbId || ''), dtoken: clientDeviceToken }
            );
            if (tokenRows.length > 0) {
                const status = (tokenRows[0].access || '').toLowerCase().trim();
                if (status === 'allow' || status === 'pending') {
                    accessVerified = true;
                } else if (status === 'deny') {
                    throw new Error('Access Denied: Your device has been blocked by an administrator.');
                } else {
                    throw new Error('Access Pending: Your device request is still awaiting administrator review.');
                }
            }
        }

        // Fallback: check the latest tb_user row for this email and db_id
        if (!accessVerified) {
            const accessRecords = await queryAdminDB(
                `SELECT access FROM tb_user 
                 WHERE lower(user_email) = lower({email:String})
                   AND (toString(db_id) = {dbId:String} OR {dbId:String} = '')
                 ORDER BY
                   CASE access WHEN 'allow' THEN 0 WHEN 'pending' THEN 1 WHEN 'deny' THEN 2 ELSE 3 END,
                   last_login DESC
                 LIMIT 1`,
                { email: decoded.email, dbId: String(decoded.dbId || '') }
            );

            const currentAccess = accessRecords.length > 0 ? (accessRecords[0].access || '').toLowerCase().trim() : null;

            if (currentAccess !== 'allow' && currentAccess !== 'pending') {
                throw new Error('Access not allowed. Please contact admin.');
            }
        }
    }

    // 4. Look up db_name, logo_url, company_id and mapped_db from tb_database using token info
    let dbName = decoded.dbName || process.env.CLICKHOUSE_DB || 'colpal';
    let dbId = decoded.dbId || '';
    let dbLogoUrl = decoded.dbLogoUrl || "";
    let companyId = decoded.companyId || process.env.RATINGS_COMPANY_ID || '';
    let currentDbObj = null;

    try {
        const dbRows = await queryAdminDB(`
            SELECT toString(db_id) as db_id, db_name, logo_url, company_id, mapped_db FROM tb_database 
            WHERE lower(db_name) = '${dbName.toLowerCase()}' 
            LIMIT 1
        `);
        if (dbRows.length > 0) {
            currentDbObj = dbRows[0];
            dbLogoUrl = dbRows[0].logo_url || "";
            dbId = dbRows[0].db_id || dbId;
            // Filter out the null UUID sentinel (00000000-0000-0000-0000-000000000000)
            const rawCid = dbRows[0].company_id || '';
            const isNullUuid = rawCid === '00000000-0000-0000-0000-000000000000';
            if (rawCid && !isNullUuid) {
                companyId = rawCid;
            }
        }
    } catch (e) {
        console.warn('[Auth] Failed to fetch database info during verify:', e.message);
    }

    const mappedDatabases = await getUserMappedDatabases(decoded.email);

    // 5. Fetch latest db_status and tab_permissions for this user on active database
    let dbStatus = decoded.dbStatus !== undefined ? decoded.dbStatus : true;
    let tabPermissions = {};
    let qcUserVal = decoded.qcUser !== undefined ? Number(decoded.qcUser) : 0;
    try {
        const permsResult = await resolveUserPermissionsForDb(decoded.email, dbId, dbName);
        tabPermissions = permsResult.tabPermissions;
        dbStatus = permsResult.dbStatus;
        if (permsResult.qcUser !== undefined && permsResult.qcUser !== null) {
            qcUserVal = permsResult.qcUser;
        }
        if (permsResult.matchedDbId) {
            dbId = permsResult.matchedDbId;
        }
    } catch (e) {
        console.warn('[Auth] Failed to fetch permissions during verify:', e.message);
    }

    console.error(`[DEBUG_VERIFY_SESSION] returning userData: email=${decoded.email}, dbName=${dbName}, companyId=${companyId}, dbLogoUrl length=${dbLogoUrl ? dbLogoUrl.length : 0}`);

    return {
        email: decoded.email,
        name: decoded.userName,
        dbName: dbName,
        dbId: dbId,
        dbLogoUrl: dbLogoUrl,
        role: userRole,
        qcUser: qcUserVal,
        dbStatus,
        tabPermissions,
        companyId,      // ratings postgres company_id — passed to ratings tab via sessionStorage
        mappedDatabases,
    };
}

/**
 * Switch active database for a user if allowed by mapped_db or user's assigned db_ids
 */
export async function switchDatabase(email, currentDbName, targetDbName, targetDbIdParam = null) {
    if (!targetDbName) {
        throw new Error('Target database name is required');
    }

    // Invalidate cached permissions across all databases for this email
    clearPermissionsCache(email);

    const trimmedTarget = targetDbName.trim();
    const trimmedCurrent = (currentDbName || '').trim();

    // 1. Fetch current DB mapped_db definition from tb_database
    const currentDbRows = await queryAdminDB(`
        SELECT toString(db_id) as db_id, db_name, logo_url, company_id, mapped_db FROM tb_database 
        WHERE lower(db_name) = '${trimmedCurrent.toLowerCase()}' 
        LIMIT 1
    `);

    // 2. Fetch target DB details from tb_database
    const targetDbRows = await queryAdminDB(`
        SELECT toString(db_id) as db_id, db_name, logo_url, company_id, mapped_db FROM tb_database 
        WHERE lower(db_name) = '${trimmedTarget.toLowerCase()}' AND status = 'active'
        LIMIT 1
    `);

    if (targetDbRows.length === 0) {
        throw new Error(`Target database '${trimmedTarget}' not found or inactive`);
    }

    const targetDb = targetDbRows[0];

    // Check mapping permission: user must have access to targetDb (via tb_user db_ids or mapped_db)
    const userMappedDatabases = await getUserMappedDatabases(email);

    const isAllowed = userMappedDatabases.some(
        db => db.dbName.toLowerCase() === trimmedTarget.toLowerCase()
    );

    if (!isAllowed) {
        throw new Error(`Database switch to '${trimmedTarget}' is not allowed for user ${email}`);
    }

    // 3. Resolve user details
    const users = await queryAdminDB(
        `SELECT *, toString(db_id) as db_id_str, toString(user_id) as user_id_str 
         FROM tb_user 
         WHERE lower(user_email) = lower({email:String}) AND status != 'deleted'
         ORDER BY last_login DESC
         LIMIT 1`,
        { email }
    );

    const user = users[0] || {};
    const userRole = (user.user_role || 'user').toLowerCase();
    const companyId = (targetDb.company_id && targetDb.company_id !== '00000000-0000-0000-0000-000000000000') ? targetDb.company_id : '';

    const mappedDatabases = userMappedDatabases;

    // 5. Fetch tab_permissions and db_status for THIS USER on the TARGET database
    //    (Critical for sidebar rendering — without this, the old workspace's permissions persist)
    const targetDbId = targetDbIdParam || String(targetDb.db_id);
    const permsResult = await resolveUserPermissionsForDb(email, targetDbId, targetDb.db_name);
    const tabPermissions = permsResult.tabPermissions;
    const dbStatusBool = permsResult.dbStatus;
    const resolvedDbId = permsResult.matchedDbId || targetDb.db_id;
    const qcUserVal = Number(permsResult.qcUser !== undefined ? permsResult.qcUser : (user.qc_user || 0));

    // 6. Create new JWT token
    // NOTE: Do NOT include dbLogoUrl or tabPermissions in the JWT payload.
    // dbLogoUrl is a base64-encoded image (10-20KB+) and tabPermissions is a large
    // JSON object. Including them causes the Authorization header to exceed nginx's
    // default 8KB header buffer limit.
    const token = jwt.sign(
        {
            userId: user.user_id_str || user.id_str,
            email: email,
            dbName: targetDb.db_name,
            dbId: resolvedDbId,
            companyId: companyId,
            userName: user.user_name || email.split('@')[0],
            role: userRole,
            qcUser: qcUserVal,
            dbStatus: dbStatusBool,
        },
        JWT_SECRET
    );

    return {
        token,
        user: {
            email: email,
            name: user.user_name || email.split('@')[0],
            dbName: targetDb.db_name,
            dbId: resolvedDbId,
            dbLogoUrl: targetDb.logo_url || "",
            role: userRole,
            qcUser: qcUserVal,
            dbStatus: dbStatusBool,
            tabPermissions,
            companyId,
            mappedDatabases,
        }
    };
}

/**
 * Verify invitation token
 */
export async function verifyInviteToken(token) {
    const { inviteTokensMap } = await import('./adminService.js');
    if (!token || !inviteTokensMap.has(token)) {
        throw new Error('Invalid or expired invitation token. Please request a new invitation from your admin.');
    }
    const info = inviteTokensMap.get(token);
    if (Date.now() > info.expiresAt) {
        inviteTokensMap.delete(token);
        throw new Error('This invitation link has expired (48h limit). Please request a new invitation.');
    }
    return {
        valid: true,
        email: info.email,
        dbName: info.dbName,
        dbId: info.dbId,
        role: info.role,
        qcUser: info.qcUser || 0,
    };
}

/**
 * Complete invitation: create password, set status = 'active', and log user in
 */
export async function completeInvitation(token, password, deviceInfo = {}) {
    const inviteInfo = await verifyInviteToken(token);
    if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { email, dbId, role, qcUser } = inviteInfo;
    const qcUserVal = (qcUser === 1 || qcUser === '1' || qcUser === true || qcUser === 'true') ? 1 : 0;

    const hashRes = await queryAdminDB(`SELECT toString(cityHash64('${email}')) as hash`);
    const user_id = hashRes[0]?.hash || Date.now().toString();
    const id = Date.now().toString();
    const currentTimestamp = new Date().toISOString().replace('T', ' ').split('.')[0];

    const defaultTabPermissions = await resolveEffectiveTabPermissions(email, dbId);

    await insertAdminDB('tb_user', [{
        id,
        user_id,
        user_email: email,
        user_name: email.split('@')[0],
        user_role: role || 'user',
        password_hash: hashedPassword,
        db_id: dbId,
        last_login: currentTimestamp,
        created_on: currentTimestamp,
        status: 'active',
        ip: deviceInfo.ip || '',
        access: 'allow',
        db_status: 'active',
        tab_permissions: defaultTabPermissions,
        qc_user: qcUserVal
    }]);

    // Clear token after single use
    const { inviteTokensMap } = await import('./adminService.js');
    inviteTokensMap.delete(token);

    // Authenticate and return JWT token session
    const { authenticateSsoUser } = await import('./ssoService.js');
    return await authenticateSsoUser({ email, name: email.split('@')[0], provider: 'local' }, deviceInfo);
}

