// src/services/authService.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { queryAdminDB, insertAdminDB } from '../config/adminClickhouse.js';
import { toFlatPermissions } from './adminService.js';
import { generateDeviceToken } from './deviceService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';
const JWT_EXPIRY = '7d';

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

    // 1. Find user by email (get latest active row)
    const users = await queryAdminDB(
        `SELECT *, toString(db_id) as db_id_str, toString(id) as id_str, toString(user_id) as user_id_str 
         FROM tb_user 
         WHERE user_email = {email:String} AND status = 'active'
         ORDER BY last_login DESC
         LIMIT 1`,
        { email }
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

    // 3. Look up db_name from tb_database using db_id
    const databases = await queryAdminDB(
        `SELECT db_name, toString(db_id) as db_id, logo_url 
         FROM tb_database 
         WHERE status = 'active'`
    );

    let dbName = process.env.CLICKHOUSE_DB || 'colpal';
    let dbLogoUrl = "";
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

    if (matchedDb) {
        dbName = matchedDb.db_name;
        dbLogoUrl = matchedDb.logo_url || "";
        console.log(`[Auth] ✅ Database mapped for ${user.user_email}: ${dbName} (id: ${userDbId})`);
    } else {
        console.warn(`[Auth] ⚠️ No matching database found for db_id=${userDbId}, using fallback: ${dbName}`);
    }

    // Workaround for readonly permission on tb_user: force mars for user
    if (user.user_email === 'kenilkavar@gmail.com') {
        dbName = 'mars';
        console.log(`[Auth] 💡 Manual override: forcing dbName='mars' for ${user.user_email}`);
    }

    // Map user_role to role (default to 'user' if not specified)
    const userRole = user.user_role || 'user';
    const normalizedRole = userRole.toLowerCase();
    const isAdmin = normalizedRole.includes('admin') || normalizedRole.includes('super');

    console.log(`[DEBUG_AUTH] Login Attempt: ${user.user_email} | Role: ${userRole} | IsAdmin: ${isAdmin} | IP: ${clientIp || '0.0.0.0'}`);

    // ========================================================================
    // 4. TRUSTED DEVICE ACCESS CONTROL  (all within tb_user table)
    // ========================================================================
    let resolvedDeviceToken = null;
    let isNewDeviceToken = false;

    if (!isAdmin) {
        let matchedRow = null;

        // Step A: Try device_token cookie (PRIMARY — survives fingerprint changes)
        // NOTE: ClickHouse is append-only; multiple rows may exist for the same
        // device_token with different access values (pending → allow). We MUST
        // prefer the 'allow' row if one exists, otherwise we'd keep seeing
        // "Access Pending" even after admin approval.
        if (incomingDeviceToken) {
            const tokenRows = await queryAdminDB(
                `SELECT access, device_token, ip
                 FROM tb_user
                 WHERE user_email = {email:String}
                   AND device_token = {dtoken:String}
                 ORDER BY
                   CASE access WHEN 'allow' THEN 0 WHEN 'deny' THEN 1 ELSE 2 END,
                   last_login DESC
                 LIMIT 1`,
                { email: user.user_email, dtoken: incomingDeviceToken }
            );
            if (tokenRows.length > 0) {
                matchedRow = tokenRows[0];
                console.log(`[DEBUG_AUTH] Device token match for ${user.user_email}: access=${matchedRow.access}`);
            }
        }

        // Step B: Fall back to fingerprint/IP lookup (SECONDARY)
        // Same priority logic: prefer 'allow' over stale 'pending' rows.
        if (!matchedRow && fingerprintId) {
            const fpRows = await queryAdminDB(
                `SELECT access, device_token, ip
                 FROM tb_user
                 WHERE user_email = {email:String}
                   AND ip = {fp:String}
                 ORDER BY
                   CASE access WHEN 'allow' THEN 0 WHEN 'deny' THEN 1 ELSE 2 END,
                   last_login DESC
                 LIMIT 1`,
                { email: user.user_email, fp: fingerprintId }
            );
            if (fpRows.length > 0) {
                matchedRow = fpRows[0];
                console.log(`[DEBUG_AUTH] Fingerprint match for ${user.user_email}: access=${matchedRow.access}`);
                // If approved but cookie was lost/cleared, we'll issue a fresh cookie
                if ((matchedRow.access || '').toLowerCase().trim() === 'allow') {
                    isNewDeviceToken = true;
                    // Use the existing token if the row had one, else generate a new one
                    if (!matchedRow.device_token) {
                        isNewDeviceToken = true;
                    }
                }
            }
        }

        // Step C: Evaluate access status
        if (matchedRow) {
            const currentAccess = (matchedRow.access || '').toLowerCase().trim();

            if (currentAccess === 'allow') {
                // ✅ Approved — allow login
                resolvedDeviceToken = matchedRow.device_token || incomingDeviceToken || generateDeviceToken();
                isNewDeviceToken = isNewDeviceToken || !matchedRow.device_token;
                console.log(`[DEBUG_AUTH] ENFORCEMENT: Granting access to ${user.user_email} via approved device`);
            } else if (currentAccess === 'deny') {
                throw new Error('Access Denied: Your access request has been rejected by an administrator.');
            } else {
                // pending
                throw new Error('Access Pending: Your request is still awaiting administrator review.');
            }
        } else {
            // Step D: No existing record for this specific device/browser.
            // Every new device requires explicit admin approval.
            console.log(`[DEBUG_AUTH] New device detected for ${user.user_email}, creating pending access request`);
            const newToken = generateDeviceToken();
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
                    access: 'pending',
                    db_status: user.db_status || 'active',
                    tab_permissions: user.tab_permissions || '',
                    device_token: newToken,
                    browser: browser || '',
                    browser_version: browserVersion || '',
                    operating_system: os || '',
                    platform: platform || '',
                }]);
                console.log(`[DEBUG_AUTH] Created new pending request for ${user.user_email}`);
            } catch (ipError) {
                console.error(`[DEBUG_AUTH] Failed to insert pending row:`, ipError.message);
            }
            throw new Error('Access Request Submitted: Please wait for admin approval.');
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
            tab_permissions: user.tab_permissions || '',
            device_token: resolvedDeviceToken || '',
            browser: browser || '',
            browser_version: browserVersion || '',
            operating_system: os || '',
            platform: platform || '',
        }]);
    } catch (logError) {
        console.error(`[DEBUG_AUTH] Error logging success:`, logError.message);
    }

    // Fetch the latest non-empty db_status and tab_permissions for this user
    let tabPermissions = {};
    let dbStatusBool = true;
    try {
        const permRows = await queryAdminDB(
            `SELECT 
                ifNull(argMaxIf(db_status, last_login, db_status != ''), 'active') as db_status,
                ifNull(argMaxIf(tab_permissions, last_login, tab_permissions != ''), '') as tab_permissions
             FROM tb_user 
             WHERE user_email = {email:String}`,
            { email: user.user_email }
        );
        if (permRows.length > 0) {
            dbStatusBool = (!permRows[0].db_status || permRows[0].db_status === '' || permRows[0].db_status === 'active');
            try {
                if (permRows[0].tab_permissions && permRows[0].tab_permissions.trim()) {
                    tabPermissions = toFlatPermissions(JSON.parse(permRows[0].tab_permissions));
                }
            } catch (e) { /* ignore parse errors */ }
        }
    } catch (e) {
        console.warn('[Auth] Failed to fetch permissions during login:', e.message);
    }

    // 6. Generate JWT token
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
        role: userRole,
        dbStatus: dbStatusBool,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return {
        token,
        user: {
            email: user.user_email,
            name: user.user_name,
            dbName: dbName,
            dbLogoUrl: dbLogoUrl,
            role: userRole,
            dbStatus: dbStatusBool,
            tabPermissions
        },
        // Device token info for the controller to set the HTTP-only cookie
        deviceToken: resolvedDeviceToken,
        isNewDeviceToken,
    };
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

        // Check via device_token cookie first (if present)
        if (deviceToken) {
            const tokenRows = await queryAdminDB(
                `SELECT access FROM tb_user
                 WHERE user_email = {email:String}
                   AND device_token = {dtoken:String}
                 ORDER BY last_login DESC
                 LIMIT 1`,
                { email: decoded.email, dtoken: deviceToken }
            );
            if (tokenRows.length > 0) {
                const status = (tokenRows[0].access || '').toLowerCase().trim();
                if (status === 'allow') {
                    accessVerified = true;
                } else if (status === 'deny') {
                    throw new Error('Access Denied: Your device has been blocked by an administrator.');
                } else {
                    throw new Error('Access Pending: Your device request is still awaiting administrator review.');
                }
            }
        }

        // Fallback: check the latest tb_user row for this email (no device_token filter)
        if (!accessVerified) {
            const accessRecords = await queryAdminDB(
                `SELECT access FROM tb_user 
                 WHERE user_email = {email:String}
                 ORDER BY last_login DESC
                 LIMIT 1`,
                { email: decoded.email }
            );

            const currentAccess = accessRecords.length > 0 ? (accessRecords[0].access || '').toLowerCase().trim() : null;

            if (currentAccess !== 'allow') {
                throw new Error('Access not allowed. Please contact admin.');
            }
        }
    }

    // 4. Look up db_name from tb_database using token info
    let dbName = decoded.dbName || process.env.CLICKHOUSE_DB || 'colpal';
    let dbLogoUrl = decoded.dbLogoUrl || "";

    try {
        const dbRows = await queryAdminDB(`
            SELECT logo_url FROM tb_database 
            WHERE lower(db_name) = '${dbName.toLowerCase()}' 
            LIMIT 1
        `);
        if (dbRows.length > 0) {
            dbLogoUrl = dbRows[0].logo_url || "";
        }
    } catch (e) {
        console.warn('[Auth] Failed to fetch database logo during verify:', e.message);
    }

    // 5. Fetch latest db_status and tab_permissions for this user
    let dbStatus = decoded.dbStatus !== undefined ? decoded.dbStatus : true;
    let tabPermissions = decoded.tabPermissions || {};
    try {
        const permRows = await queryAdminDB(
            `SELECT 
                ifNull(argMaxIf(db_status, last_login, db_status != ''), 'active') as db_status,
                ifNull(argMaxIf(tab_permissions, last_login, tab_permissions != ''), '') as tab_permissions
             FROM tb_user 
             WHERE user_email = {email:String}`,
            { email: decoded.email }
        );
        if (permRows.length > 0) {
            dbStatus = (!permRows[0].db_status || permRows[0].db_status === '' || permRows[0].db_status === 'active');
            try {
                if (permRows[0].tab_permissions && permRows[0].tab_permissions.trim()) {
                    tabPermissions = toFlatPermissions(JSON.parse(permRows[0].tab_permissions));
                }
            } catch (e) { /* ignore */ }
        }
    } catch (e) {
        console.warn('[Auth] Failed to fetch permissions during verify:', e.message);
    }

    console.error(`[DEBUG_VERIFY_SESSION] returning userData: email=${decoded.email}, dbName=${dbName}, dbLogoUrl length=${dbLogoUrl ? dbLogoUrl.length : 0}`);

    return {
        email: decoded.email,
        name: decoded.userName,
        dbName: dbName,
        dbLogoUrl: dbLogoUrl,
        role: userRole,
        dbStatus,
        tabPermissions
    };
}
