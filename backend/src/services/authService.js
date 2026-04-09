// src/services/authService.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { queryAdminDB, insertAdminDB } from '../config/adminClickhouse.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';
const JWT_EXPIRY = '24h';

/**
 * Authenticate user by email and password
 * 1. Look up user in admin_master.tb_user by email
 * 2. Verify bcrypt password hash
 * 3. Look up db_name from admin_master.tb_database using db_id
 * 4. Return JWT token with user context
 */
export async function loginUser(email, password, clientIp = '') {
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
    // Using toString() comparison to avoid UInt64 precision issues
    const databases = await queryAdminDB(
        `SELECT db_name, toString(db_id) as db_id 
         FROM tb_database 
         WHERE status = 'active'`
    );

    // Find matching database - handle potential UInt64 precision mismatch
    let dbName = process.env.CLICKHOUSE_DB || 'colpal'; // fallback
    const userDbId = user.db_id_str;

    // Try exact match first
    let matchedDb = databases.find(db => db.db_id === userDbId);

    // If no exact match, try finding closest match (for UInt64 precision issues)
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

        // Only accept if difference is small (within tolerance for UInt64 precision)
        if (closestDb && closestDiff < BigInt('1000')) {
            matchedDb = closestDb;
            console.log(`[Auth] db_id approximate match: user=${userDbId}, db=${closestDb.db_id}, diff=${closestDiff}`);
        }
    }

    if (matchedDb) {
        dbName = matchedDb.db_name;
    } else {
        console.warn(`[Auth] No matching database found for db_id=${userDbId}, using fallback: ${dbName}`);
    }

    // Workaround for readonly permission on tb_user: force mars for user
    if (user.user_email === 'kenilkavar@gmail.com') {
        dbName = 'mars';
    }

    // Map user_role to role (default to 'user' if not specified)
    const userRole = user.user_role || 'user';
    const normalizedRole = userRole.toLowerCase();
    const isAdmin = normalizedRole.includes('admin') || normalizedRole.includes('super');

    console.log(`[DEBUG_AUTH] Login Attempt: ${user.user_email} | Role: ${userRole} | IsAdmin: ${isAdmin} | IP: ${clientIp || '0.0.0.0'}`);

    // 4. Access Control Enforcement (Zero-Trust Logic)
    if (!isAdmin) {
        // Query ALL rows for this user and IP to find the most recent decision
        const accessRecords = await queryAdminDB(
            `SELECT access FROM tb_user 
             WHERE user_email = {email:String} AND ip = {ip:String}
             ORDER BY last_login DESC
             LIMIT 1`,
            { email: user.user_email, ip: clientIp || '0.0.0.0' }
        );

        const currentAccess = accessRecords.length > 0 ? (accessRecords[0].access || '').toLowerCase().trim() : null;
        console.log(`[DEBUG_AUTH] Database Status for ${user.user_email} on IP ${clientIp || '0.0.0.0'}: '${currentAccess}'`);

        // ONLY EXPLICIT 'ALLOW' IS PERMITTED
        if (currentAccess !== 'allow') {
            console.log(`[DEBUG_AUTH] ENFORCEMENT: Blocking ${user.user_email} because status is '${currentAccess}' (Not 'allow')`);

            // If no record exists at all, create the first one
            if (!currentAccess) {
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
                        ip: clientIp || '0.0.0.0',
                        access: 'pending'
                    }]);
                    console.log(`[DEBUG_AUTH] Created new Pending request for ${user.user_email}`);
                } catch (ipError) {
                    console.error(`[DEBUG_AUTH] Failed to insert pending row:`, ipError.message);
                }
                throw new Error('Access Request Submitted: Please wait for admin approval.');
            }

            // If it's explicitly 'deny', show denied message
            if (currentAccess === 'deny') {
                throw new Error('Access Denied: Your access request has been rejected by an administrator.');
            }

            // Otherwise, it's pending (either explicitly or effectively)
            throw new Error('Access Pending: Your request is still awaiting administrator review.');
        }

        console.log(`[DEBUG_AUTH] ENFORCEMENT: Granting access to ${user.user_email} (Status: 'allow')`);
    } else {
        console.log(`[DEBUG_AUTH] ENFORCEMENT: Admin bypass for ${user.user_email}`);
    }

    // 5. Track successful login history
    try {
        const rowId = (Date.now() + 1).toString(); // Unique sequential ID
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
            ip: clientIp || '0.0.0.0',
            access: 'allow'
        }]);
    } catch (logError) {
        console.error(`[DEBUG_AUTH] Error logging success:`, logError.message);
    }

    // 4. Generate JWT token
    const tokenPayload = {
        userId: user.user_id,
        email: user.user_email,
        userName: user.user_name,
        dbName: dbName,
        role: userRole
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return {
        token,
        user: {
            email: user.user_email,
            name: user.user_name,
            dbName: dbName,
            role: userRole
        },
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
 * Verify an existing session: decode the JWT AND re-check access permissions.
 * Called on page refresh to ensure the user still has valid access.
 */
export async function verifySession(token) {
    // 1. Verify token signature and expiry
    const decoded = verifyToken(token);

    // 2. Determine role from token
    const userRole = decoded.role || 'user';
    const normalizedRole = userRole.toLowerCase();
    const isAdmin = normalizedRole.includes('admin') || normalizedRole.includes('super');

    // 3. For non-admin users, re-check access status from database
    if (!isAdmin) {
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

    // 4. Look up db_name from tb_database using token info
    let dbName = decoded.dbName || process.env.CLICKHOUSE_DB || 'colpal';

    return {
        email: decoded.email,
        name: decoded.userName,
        dbName: dbName,
        role: userRole
    };
}
