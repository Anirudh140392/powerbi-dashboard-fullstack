// src/controllers/authController.js
import crypto from 'crypto';
import { loginUser, verifySession } from '../services/authService.js';
import { getDeviceCookieOptions, updateDeviceTokenMap } from '../services/deviceService.js';

/**
 * POST /api/auth/login
 * Body: { email, password, visitorId, browser, browserVersion, os, platform }
 * Cookie: device_token (HTTP-only, read automatically)
 * Returns: { token, user: { email, name, dbName } }
 * Sets: device_token HTTP-only cookie on successful login
 */
export const login = async (req, res) => {
    try {
        const { email, password, visitorId, publicIp, browser, browserVersion, os, platform } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }

        // Extract real client IP for logging purposes
        let clientIp = req.ip || req.socket?.remoteAddress || '';
        if (req.headers && req.headers['x-forwarded-for']) {
            clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
        }
        if (clientIp === '::1') {
            clientIp = '127.0.0.1';
        } else if (clientIp.startsWith('::ffff:')) {
            clientIp = clientIp.substring(7);
        }

        // Read device_token from HTTP-only cookie (primary device identifier)
        const deviceTokenFromCookie = req.cookies?.device_token || null;

        // Use visitorId (FingerprintJS) as fingerprint, fall back to publicIp for backward compat
        const fingerprintId = visitorId || publicIp || '';

        const result = await loginUser(email, password, {
            deviceToken: deviceTokenFromCookie,
            fingerprintId,
            browser: browser || '',
            browserVersion: browserVersion || '',
            os: os || '',
            platform: platform || '',
            ip: clientIp,
        });

        // Set device_token as HTTP-only secure cookie map (supports multiple logged in clients)
        if (result.deviceToken) {
            const updatedCookie = updateDeviceTokenMap(
                deviceTokenFromCookie,
                result.user?.dbId,
                email,
                result.deviceToken
            );
            res.cookie('device_token', updatedCookie, getDeviceCookieOptions());
        }

        return res.status(200).json({
            success: true,
            token: result.token,
            user: result.user,
        });
    } catch (error) {
        console.error('[Auth] Login failed:', error.message);
        if (error.deviceToken) {
            const updatedCookie = updateDeviceTokenMap(
                deviceTokenFromCookie,
                error.dbId,
                email,
                error.deviceToken
            );
            res.cookie('device_token', updatedCookie, getDeviceCookieOptions());
        }
        return res.status(401).json({
            success: false,
            error: error.message || 'Invalid email or password',
        });
    }
};

/**
 * GET /api/auth/verify
 * Headers: Authorization: Bearer <token>
 * Cookie: device_token (HTTP-only, read automatically)
 * Returns: { success: true, user: { email, name, dbName, role } }
 * 
 * Re-validates the JWT token and checks current device access.
 * Called on page refresh to ensure session is still valid.
 */
export const verify = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided',
            });
        }

        const token = authHeader.split(' ')[1];
        const deviceTokenFromCookie = req.cookies?.device_token || null;
        const userData = await verifySession(token, deviceTokenFromCookie);

        return res.status(200).json({
            success: true,
            user: userData,
        });
    } catch (error) {
        console.error('[Auth] Verify failed:', error.message);
        return res.status(401).json({
            success: false,
            error: error.message || 'Session invalid',
        });
    }
};

/**
 * GET /api/auth/ratings-sso-token
 * Requires: valid DS JWT (authMiddleware already decoded req.user)
 *
 * Generates a short-lived HMAC-SHA256 signed token so the ratings backend
 * (/api/auth/sso) can issue a full ratings session without a password.
 *
 * Token format: base64url(<json>).<base64url(HMAC-SHA256)>
 * Payload: { email, exp }   (exp = ms timestamp, 60 s from now)
 */
export const ratingssSsoToken = (req, res) => {
    try {
        const email = req.user?.email;
        if (!email) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const SSO_SECRET = process.env.SSO_SECRET || '';
        if (!SSO_SECRET) {
            return res.status(500).json({ success: false, error: 'SSO not configured on server' });
        }

        const RATINGS_API_URL = process.env.RATINGS_API_URL || 'http://localhost:3001';

        const payload = { email, exp: Date.now() + 60_000 }; // 60 second TTL
        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = crypto
            .createHmac('sha256', SSO_SECRET)
            .update(payloadB64)
            .digest('base64url');

        const ssoToken = `${payloadB64}.${sig}`;

        return res.json({
            success: true,
            ssoToken,
            ratingsApiUrl: RATINGS_API_URL,
        });
    } catch (error) {
        console.error('[SSO] Failed to generate SSO token:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to generate SSO token' });
    }
};
