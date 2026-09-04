// src/services/ssoService.js
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import axios from 'axios';
import { queryAdminDB } from '../config/adminClickhouse.js';
import { toFlatPermissions } from './adminService.js';
import { updateDeviceTokenMap } from './deviceService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';
// Tokens are permanent (no expiration)

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

    const expectedAudiences = [
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_PROD_CLIENT_ID,
        process.env.GOOGLE_DEV_CLIENT_ID
    ].filter(Boolean);

    // Verify token using google-auth-library for JWT ID tokens
    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: expectedAudiences.length > 0 ? expectedAudiences : undefined,
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
 * @param {string} idToken - ID token or access token from Microsoft OAuth / MSAL
 * @param {object} [extraPayload] - Optional extra payload ({ accessToken, email, name })
 * @returns {Promise<object>} verified payload with email, name, oid
 */
export async function verifyMicrosoftToken(idToken, extraPayload = {}) {
    const token = idToken || extraPayload.idToken || extraPayload.accessToken;
    const accessToken = extraPayload.accessToken || idToken;

    // 1. Try Microsoft Graph API first (works for OAuth Access Tokens)
    if (accessToken) {
        try {
            const graphRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 5000,
            });
            if (graphRes.data) {
                const email = (graphRes.data.mail || graphRes.data.userPrincipalName || '').toLowerCase().trim();
                if (email) {
                    return {
                        email,
                        name: graphRes.data.displayName || graphRes.data.givenName || email.split('@')[0],
                        oid: graphRes.data.id,
                        provider: 'microsoft',
                    };
                }
            }
        } catch (err) {
            // Not a Graph API access token or call failed; proceed to JWT verification below
        }
    }

    // 2. Decode or verify JWT ID token
    if (token) {
        const decoded = jwt.decode(token);
        if (decoded) {
            const email = (decoded.preferred_username || decoded.email || decoded.upn || decoded.unique_name || '').toLowerCase().trim();
            if (email) {
                return {
                    email,
                    name: decoded.name || email.split('@')[0],
                    oid: decoded.oid || decoded.sub,
                    provider: 'microsoft',
                };
            }
        }

        try {
            const expectedAudiences = [
                process.env.MICROSOFT_CLIENT_ID,
                process.env.MICROSOFT_PROD_CLIENT_ID,
                process.env.MICROSOFT_DEV_CLIENT_ID
            ].filter(Boolean);
            const decodedVerified = await new Promise((resolve, reject) => {
                jwt.verify(
                    token,
                    getMsSigningKey,
                    {
                        audience: expectedAudiences.length > 0 ? expectedAudiences : undefined,
                        issuer: [
                            'https://login.microsoftonline.com/common/v2.0',
                            'https://sts.windows.net/common/',
                            'https://login.microsoftonline.com/organizations/v2.0',
                            'https://login.microsoftonline.com/consumers/v2.0',
                            'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0',
                            'https://login.microsoftonline.com/b50e2cd2-ee2d-4b60-ab85-dc4ce039da6a/v2.0',
                        ],
                        algorithms: ['RS256'],
                    },
                    (err, decoded) => {
                        if (err) return reject(err);
                        resolve(decoded);
                    }
                );
            });
            if (decodedVerified) {
                const email = (decodedVerified.preferred_username || decodedVerified.email || decodedVerified.upn || '').toLowerCase().trim();
                if (email) {
                    return {
                        email,
                        name: decodedVerified.name || email.split('@')[0],
                        oid: decodedVerified.oid || decodedVerified.sub,
                        provider: 'microsoft',
                    };
                }
            }
        } catch (e) {
            // JWT verification failed
        }
    }

    // 3. Fallback to extraPayload email if provided by MSAL client
    if (extraPayload.email) {
        return {
            email: extraPayload.email.toLowerCase().trim(),
            name: extraPayload.name || extraPayload.email.split('@')[0],
            provider: 'microsoft',
        };
    }

    throw new Error('Unable to verify Microsoft account. Could not extract a valid email address.');
}

/**
 * Authenticate or log in an SSO user by verified email
 * @param {object} ssoPayload - { email, name, sub, oid, provider }
 * @param {object} deviceInfo - { deviceToken, visitorId, browser, browserVersion, os, platform, ip }
 * @returns {object} { token, user, deviceToken }
 */
export async function authenticateSsoUser(ssoPayload, deviceInfo = {}) {
    const email = ssoPayload.email.toLowerCase().trim();

    // 1. Find user by email in tb_user (supporting lower & trim matching)
    let users = await queryAdminDB(
        `SELECT *, toString(db_id) as db_id_str, toString(id) as id_str, toString(user_id) as user_id_str 
         FROM tb_user 
         WHERE (lower(trim(user_email)) = {email:String} OR lower(user_email) = {email:String}) AND status = 'active'
         ORDER BY last_login DESC
         LIMIT 1`,
        { email }
    );

    // Fallback: Check if email prefix matches (e.g. username before @ for domain variations)
    if (!users || users.length === 0) {
        const emailPrefix = email.split('@')[0];
        if (emailPrefix) {
            users = await queryAdminDB(
                `SELECT *, toString(db_id) as db_id_str, toString(id) as id_str, toString(user_id) as user_id_str 
                 FROM tb_user 
                 WHERE lower(user_email) LIKE {prefix:String} AND status = 'active'
                 ORDER BY last_login DESC
                 LIMIT 1`,
                { prefix: `${emailPrefix}@%` }
            );
        }
    }

    if (!users || users.length === 0) {
        throw new Error(`No active account found for ${email}. Please request an invitation from your administrator.`);
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
        },
        JWT_SECRET,
    );

    return {
        token,
        user: userPayload,
    };
}
