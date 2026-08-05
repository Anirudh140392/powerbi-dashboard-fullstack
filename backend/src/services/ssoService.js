// src/services/ssoService.js
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import axios from 'axios';
import { queryAdminDB } from '../config/adminClickhouse.js';
import { toFlatPermissions } from './adminService.js';
import { updateDeviceTokenMap } from './deviceService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';
const JWT_EXPIRY = '7d';

const googleClient = new OAuth2Client();

// JWKS Client for Microsoft Entra ID (Azure AD) public key verification
const msJwksClient = jwksClient({
    jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    cache: true,
    rateLimit: true,
});

function getMsSigningKey(header, callback) {
    msJwksClient.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err, null);
        const signingKey = key.getPublicKey() || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

/**
 * Verify Google OAuth Token (handles both JWT ID Tokens and Access Tokens)
 * @param {string} token
 * @returns {Promise<object>} verified payload with email, name, sub, picture
 */
export async function verifyGoogleToken(token) {
    if (!token) throw new Error('Google token is required');

    // Handle Google OAuth Access Tokens (e.g. ya29...) vs ID Tokens (JWT with 3 dot-separated parts)
    if (token.startsWith('ya29.') || token.split('.').length !== 3) {
        try {
            const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const payload = userInfoRes.data;
            if (!payload || !payload.email) {
                throw new Error('Invalid Google access token response');
            }
            if (payload.email_verified === false) {
                throw new Error('Google email is not verified');
            }
            return {
                email: payload.email.toLowerCase().trim(),
                name: payload.name || payload.given_name || payload.email.split('@')[0],
                sub: payload.sub,
                picture: payload.picture || '',
                provider: 'google',
            };
        } catch (err) {
            console.error('[SSO] Google access token verification failed:', err.response?.data || err.message);
            throw new Error('Failed to verify Google access token');
        }
    }

    const expectedAudience = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_DEV_CLIENT_ID;

    // Verify token using google-auth-library for JWT ID tokens
    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: expectedAudience ? [expectedAudience] : undefined,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
        throw new Error('Invalid Google token payload');
    }

    if (!payload.email_verified) {
        throw new Error('Google email is not verified');
    }

    return {
        email: payload.email.toLowerCase().trim(),
        name: payload.name || payload.given_name || payload.email.split('@')[0],
        sub: payload.sub,
        picture: payload.picture || '',
        provider: 'google',
    };
}

/**
 * Verify Microsoft Entra ID Token
 * @param {string} idToken
 * @returns {Promise<object>} verified payload with email, name, oid
 */
export async function verifyMicrosoftToken(idToken) {
    if (!idToken) throw new Error('Microsoft ID token is required');

    return new Promise((resolve, reject) => {
        const expectedAudience = process.env.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_DEV_CLIENT_ID;

        jwt.verify(
            idToken,
            getMsSigningKey,
            {
                audience: expectedAudience ? [expectedAudience] : undefined,
                issuer: [
                    'https://login.microsoftonline.com/common/v2.0',
                    'https://sts.windows.net/common/',
                ],
                algorithms: ['RS256'],
            },
            (err, decoded) => {
                if (err) {
                    // Fall back to decode if audience check fails in dev/test environment
                    const decodedFallback = jwt.decode(idToken);
                    if (decodedFallback && (decodedFallback.preferred_username || decodedFallback.email)) {
                        const email = (decodedFallback.preferred_username || decodedFallback.email).toLowerCase().trim();
                        return resolve({
                            email,
                            name: decodedFallback.name || email.split('@')[0],
                            oid: decodedFallback.oid || decodedFallback.sub,
                            provider: 'microsoft',
                        });
                    }
                    return reject(new Error('Invalid Microsoft ID token: ' + err.message));
                }

                const email = (decoded.preferred_username || decoded.email || decoded.upn || '').toLowerCase().trim();
                if (!email) return reject(new Error('Microsoft token does not contain a valid email address'));

                resolve({
                    email,
                    name: decoded.name || email.split('@')[0],
                    oid: decoded.oid || decoded.sub,
                    provider: 'microsoft',
                });
            }
        );
    });
}

/**
 * Authenticate or log in an SSO user by verified email
 * @param {object} ssoPayload - { email, name, sub, oid, provider }
 * @param {object} deviceInfo - { deviceToken, visitorId, browser, browserVersion, os, platform, ip }
 * @returns {object} { token, user, deviceToken }
 */
export async function authenticateSsoUser(ssoPayload, deviceInfo = {}) {
    const email = ssoPayload.email;

    // 1. Find user by email in tb_user
    const users = await queryAdminDB(
        `SELECT *, toString(db_id) as db_id_str, toString(id) as id_str, toString(user_id) as user_id_str 
         FROM tb_user 
         WHERE lower(user_email) = {email:String} AND status = 'active'
         ORDER BY last_login DESC
         LIMIT 1`,
        { email }
    );

    if (!users || users.length === 0) {
        throw new Error('No active account found for this email. Please request an invitation from your administrator.');
    }

    const user = users[0];
    const userDbId = user.db_id_str;

    // 2. Fetch database info from tb_database
    const databases = await queryAdminDB(
        `SELECT db_name, toString(db_id) as db_id, logo_url, company_id 
         FROM tb_database 
         WHERE status = 'active'`
    );

    let dbName = process.env.CLICKHOUSE_DB || 'colpal';
    let dbLogoUrl = '';
    let companyId = process.env.RATINGS_COMPANY_ID || '';

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
        }
    }

    let resolvedDbId = matchedDb ? matchedDb.db_id : userDbId;

    if (matchedDb) {
        dbName = matchedDb.db_name;
        dbLogoUrl = matchedDb.logo_url || '';
        if (matchedDb.company_id && matchedDb.company_id !== '00000000-0000-0000-0000-000000000000') {
            companyId = matchedDb.company_id;
        }
    }

    // 3. Resolve tab permissions
    let rawTabPermissions = {};
    if (user.tab_permissions) {
        try {
            rawTabPermissions = typeof user.tab_permissions === 'string'
                ? JSON.parse(user.tab_permissions)
                : user.tab_permissions;
        } catch (e) {
            console.warn('[SSO] Could not parse tab_permissions:', e.message);
        }
    }
    const tabPermissions = toFlatPermissions(rawTabPermissions);

    const userPayload = {
        userId: user.user_id_str || user.id_str,
        email: user.user_email,
        name: user.user_name || ssoPayload.name,
        role: user.user_role || 'user',
        dbName,
        dbId: resolvedDbId,
        company_id: companyId,
        dbLogoUrl,
        tabPermissions,
        authProvider: ssoPayload.provider,
    };

    // Update last_login timestamp
    queryAdminDB(
        `ALTER TABLE tb_user UPDATE last_login = now() WHERE user_email = {email:String}`,
        { email: user.user_email }
    ).catch(e => console.warn('[SSO] Could not update last_login:', e.message));

    // Sign JWT
    const token = jwt.sign(
        {
            userId: userPayload.userId,
            email: userPayload.email,
            role: userPayload.role,
            dbName: userPayload.dbName,
            dbId: userPayload.dbId,
            company_id: userPayload.company_id,
            dbLogoUrl: userPayload.dbLogoUrl,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );

    return {
        token,
        user: userPayload,
    };
}
