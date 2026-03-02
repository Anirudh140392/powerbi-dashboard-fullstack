// src/services/authService.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { queryAdminDB } from '../config/adminClickhouse.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';
const JWT_EXPIRY = '24h';

/**
 * Authenticate user by email and password
 * 1. Look up user in admin_master.tb_user by email
 * 2. Verify bcrypt password hash
 * 3. Look up db_name from admin_master.tb_database using db_id
 * 4. Return JWT token with user context
 */
export async function loginUser(email, password) {
    // 1. Find user by email
    const users = await queryAdminDB(
        `SELECT user_id, user_email, user_name, password_hash, toString(db_id) as db_id 
         FROM tb_user 
         WHERE user_email = {email:String} AND status = 'active'`,
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
    const userDbId = user.db_id;

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

    // 4. Generate JWT token
    const tokenPayload = {
        userId: user.user_id,
        email: user.user_email,
        userName: user.user_name,
        dbName: dbName,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return {
        token,
        user: {
            email: user.user_email,
            name: user.user_name,
            dbName: dbName,
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
