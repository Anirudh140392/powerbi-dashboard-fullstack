// src/services/authService.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { queryAdminDB, insertAdminDB } from '../config/adminClickhouse.js';
import { toFlatPermissions } from './adminService.js';
import { generateDeviceToken, getDeviceTokenForClient } from './deviceService.js';

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

    // 3. Look up db_name and company_id from tb_database using db_id
    const databases = await queryAdminDB(
        `SELECT db_name, toString(db_id) as db_id, logo_url, company_id 
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
                // // ORIGINAL CODE (COMMENTED OUT AS REQUESTED):
                // // Pending request already exists for this device
                // const err = new Error('Access Pending: Your request is still awaiting administrator review.');
                // err.deviceToken = clientDeviceToken;
                // err.dbId = user.db_id_str;
                // throw err;

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
                    tab_permissions: user.tab_permissions || '',
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

            // // ORIGINAL CODE (COMMENTED OUT AS REQUESTED):
            // const err = new Error('Access Pending: Your request is still awaiting administrator review.');
            // err.deviceToken = newToken;
            // err.dbId = user.db_id_str;
            // throw err;
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
        dbId: resolvedDbId,
        dbLogoUrl: dbLogoUrl,
        role: userRole,
        dbStatus: dbStatusBool,
        companyId,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return {
        token,
        user: {
            email: user.user_email,
            name: user.user_name,
            dbName: dbName,
            dbId: resolvedDbId,
            dbLogoUrl: dbLogoUrl,
            role: userRole,
            dbStatus: dbStatusBool,
            tabPermissions,
            companyId,      // ratings postgres company_id — stored in sessionStorage for ratings tab
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

        const clientDeviceToken = getDeviceTokenForClient(deviceToken, decoded.dbId, decoded.email);

        // Check via device_token cookie first (if present)
        if (clientDeviceToken) {
            const tokenRows = await queryAdminDB(
                `SELECT access FROM tb_user
                 WHERE user_email = {email:String}
                   AND db_id = {dbId:String}
                   AND device_token = {dtoken:String}
                 ORDER BY last_login DESC
                 LIMIT 1`,
                { email: decoded.email, dbId: decoded.dbId, dtoken: clientDeviceToken }
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

        // Fallback: check the latest tb_user row for this email and db_id
        if (!accessVerified) {
            const accessRecords = await queryAdminDB(
                `SELECT access FROM tb_user 
                 WHERE user_email = {email:String}
                   AND db_id = {dbId:String}
                 ORDER BY
                   CASE access WHEN 'allow' THEN 0 WHEN 'deny' THEN 1 ELSE 2 END,
                   last_login DESC
                 LIMIT 1`,
                { email: decoded.email, dbId: decoded.dbId }
            );

            const currentAccess = accessRecords.length > 0 ? (accessRecords[0].access || '').toLowerCase().trim() : null;

            if (currentAccess !== 'allow') {
                throw new Error('Access not allowed. Please contact admin.');
            }
        }
    }

    // 4. Look up db_name, logo_url and company_id from tb_database using token info
    let dbName = decoded.dbName || process.env.CLICKHOUSE_DB || 'colpal';
    let dbId = decoded.dbId || '';
    let dbLogoUrl = decoded.dbLogoUrl || "";
    let companyId = decoded.companyId || process.env.RATINGS_COMPANY_ID || '';

    try {
        const dbRows = await queryAdminDB(`
            SELECT toString(db_id) as db_id, logo_url, company_id FROM tb_database 
            WHERE lower(db_name) = '${dbName.toLowerCase()}' 
            LIMIT 1
        `);
        if (dbRows.length > 0) {
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

    // 5. Fetch latest db_status and tab_permissions for this user
    let dbStatus = decoded.dbStatus !== undefined ? decoded.dbStatus : true;
    let tabPermissions = decoded.tabPermissions || {};
    try {
        const permRows = await queryAdminDB(
            `SELECT 
                db_status,
                tab_permissions
             FROM tb_user 
             WHERE lower(user_email) = lower({email:String}) AND status != 'deleted'
             ORDER BY last_login DESC, created_on DESC
             LIMIT 1`,
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

    console.error(`[DEBUG_VERIFY_SESSION] returning userData: email=${decoded.email}, dbName=${dbName}, companyId=${companyId}, dbLogoUrl length=${dbLogoUrl ? dbLogoUrl.length : 0}`);

    return {
        email: decoded.email,
        name: decoded.userName,
        dbName: dbName,
        dbId: dbId,
        dbLogoUrl: dbLogoUrl,
        role: userRole,
        dbStatus,
        tabPermissions,
        companyId,      // ratings postgres company_id — passed to ratings tab via sessionStorage
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
    const { email, dbId, role } = inviteInfo;

    const hashRes = await queryAdminDB(`SELECT toString(cityHash64('${email}')) as hash`);
    const user_id = hashRes[0]?.hash || Date.now().toString();
    const id = Date.now().toString();
    const currentTimestamp = new Date().toISOString().replace('T', ' ').split('.')[0];

    let defaultTabPermissions = '';
    try {
        const permQuery = `SELECT tab_permissions FROM tb_user WHERE lower(user_email) = {email:String} AND tab_permissions != '' LIMIT 1`;
        const rows = await queryAdminDB(permQuery, { email });
        if (rows && rows.length > 0 && rows[0].tab_permissions) {
            defaultTabPermissions = rows[0].tab_permissions;
        }
    } catch (e) { /* ignore */ }

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
        tab_permissions: defaultTabPermissions
    }]);

    // Clear token after single use
    const { inviteTokensMap } = await import('./adminService.js');
    inviteTokensMap.delete(token);

    // Authenticate and return JWT token session
    const { authenticateSsoUser } = await import('./ssoService.js');
    return await authenticateSsoUser({ email, name: email.split('@')[0], provider: 'local' }, deviceInfo);
}

