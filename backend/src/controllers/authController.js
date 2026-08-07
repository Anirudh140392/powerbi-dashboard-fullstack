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
    const deviceTokenFromCookie = req.cookies?.device_token || null;
    const { email } = req.body || {};

    try {
        const { password, visitorId, publicIp, browser, browserVersion, os, platform } = req.body;

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

/**
 * GET /api/auth/verify-invite-token
 * Query: ?token=XYZ
 */
export const verifyInvite = async (req, res) => {
    try {
        const { token } = req.query;
        const { verifyInviteToken } = await import('../services/authService.js');
        const info = await verifyInviteToken(token);
        return res.status(200).json({ success: true, ...info });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || 'Invalid token' });
    }
};

/**
 * POST /api/auth/complete-invitation
 * Body: { token, password, visitorId, browser, browserVersion, os, platform }
 */
export const completeInvite = async (req, res) => {
    try {
        const { token, password, visitorId, browser, browserVersion, os, platform } = req.body || {};
        const { completeInvitation } = await import('../services/authService.js');

        let clientIp = req.ip || req.socket?.remoteAddress || '';
        if (req.headers && req.headers['x-forwarded-for']) {
            clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
        }

        const result = await completeInvitation(token, password, {
            visitorId, browser, browserVersion, os, platform, ip: clientIp
        });

        return res.status(200).json({ success: true, token: result.token, user: result.user });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || 'Failed to set password' });
    }
};

/**
 * POST /api/auth/google-login
 * Body: { credential, visitorId, browser, browserVersion, os, platform }
 */
export const googleLogin = async (req, res) => {
    try {
        const { credential, visitorId, browser, browserVersion, os, platform } = req.body || {};
        if (!credential) {
            return res.status(400).json({ success: false, error: 'Google credential token is required' });
        }

        let clientIp = req.ip || req.socket?.remoteAddress || '';
        if (req.headers && req.headers['x-forwarded-for']) {
            clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
        }

        const { verifyGoogleToken, authenticateSsoUser } = await import('../services/ssoService.js');
        const ssoPayload = await verifyGoogleToken(credential);
        const result = await authenticateSsoUser(ssoPayload, {
            visitorId, browser, browserVersion, os, platform, ip: clientIp
        });

        return res.status(200).json({ success: true, token: result.token, user: result.user });
    } catch (error) {
        console.error('[Auth] Google login failed:', error.message);
        return res.status(401).json({ success: false, error: error.message || 'Google authentication failed' });
    }
};

/**
 * POST /api/auth/microsoft-login
 * Body: { idToken, visitorId, browser, browserVersion, os, platform }
 */
export const microsoftLogin = async (req, res) => {
    try {
        const { idToken, credential, accessToken, visitorId, browser, browserVersion, os, platform } = req.body || {};
        const token = idToken || credential || accessToken;
        if (!token) {
            return res.status(400).json({ success: false, error: 'Microsoft token is required' });
        }

        let clientIp = req.ip || req.socket?.remoteAddress || '';
        if (req.headers && req.headers['x-forwarded-for']) {
            clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
        }

        const { verifyMicrosoftToken, authenticateSsoUser } = await import('../services/ssoService.js');
        const ssoPayload = await verifyMicrosoftToken(token, req.body);
        const result = await authenticateSsoUser(ssoPayload, {
            visitorId, browser, browserVersion, os, platform, ip: clientIp
        });

        return res.status(200).json({ success: true, token: result.token, user: result.user });
    } catch (error) {
        console.error('[Auth] Microsoft login failed:', error.message);
        return res.status(401).json({ success: false, error: error.message || 'Microsoft authentication failed' });
    }
};

/**
 * GET /api/auth/callback/microsoft
 * Server-side OAuth callback for Microsoft Web platform flow.
 * Microsoft redirects here with ?code=...&state=...
 * Backend exchanges the code for tokens, authenticates the user,
 * and returns an HTML page that sends the result to the opener window.
 */
export const microsoftCallback = async (req, res) => {
    try {
        // Set COOP header to unsafe-none so browser doesn't block window.opener postMessage
        res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');

        const { code, state, error: msError, error_description } = req.query;

        if (msError) {
            console.error('[Auth] Microsoft callback error:', msError, error_description);
            return res.send(buildCallbackHtml(false, null, null, error_description || msError));
        }

        if (!code) {
            return res.send(buildCallbackHtml(false, null, null, 'No authorization code received from Microsoft.'));
        }

        // Determine the correct redirect_uri (must match what was sent in the authorize request)
        const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_DEV_CLIENT_ID;
        const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.MICROSOFT_DEV_CLIENT_SECRET;
        const tenantId = process.env.MICROSOFT_TENANT_ID || process.env.MICROSOFT_DEV_TENANT_ID || 'common';

        const forwardedHost = req.headers['x-forwarded-host'];
        const referer = req.headers.referer || req.headers.referrer || '';
        const rawHost = forwardedHost || req.headers.host || '';

        let callbackUrl = process.env.MICROSOFT_CALLBACK_URL || process.env.MICROSOFT_DEV_CALLBACK_URL;
        if (referer.includes('dev.trailytics.in') || rawHost.includes('dev.trailytics.in')) {
            callbackUrl = 'https://dev.trailytics.in/api/auth/callback/microsoft';
        } else if (referer.includes('trailytics.in') || rawHost.includes('trailytics.in')) {
            callbackUrl = 'https://trailytics.in/api/auth/callback/microsoft';
        } else if (rawHost.includes('localhost') || rawHost.includes('127.0.0.1') || referer.includes('localhost')) {
            callbackUrl = 'http://localhost:9500/api/auth/callback/microsoft';
        }

        console.log('[Auth] Microsoft callback using callbackUrl:', callbackUrl, '| client_id:', clientId ? 'OK' : 'MISSING');

        if (!clientId || !clientSecret || !callbackUrl) {
            console.error('[Auth] Missing Microsoft OAuth config (CLIENT_ID, CLIENT_SECRET, or CALLBACK_URL)');
            return res.send(buildCallbackHtml(false, null, null, 'Server configuration error.'));
        }

        // Exchange authorization code for tokens
        const axios = (await import('axios')).default;
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: callbackUrl,
            grant_type: 'authorization_code',
            scope: 'openid profile email User.Read',
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000,
        });

        const { id_token, access_token } = tokenResponse.data;

        if (!id_token && !access_token) {
            return res.send(buildCallbackHtml(false, null, null, 'No tokens received from Microsoft.'));
        }

        // Verify the token and get user info
        const { verifyMicrosoftToken, authenticateSsoUser } = await import('../services/ssoService.js');
        const ssoPayload = await verifyMicrosoftToken(id_token || access_token, {
            idToken: id_token,
            accessToken: access_token,
        });

        let clientIp = req.ip || req.socket?.remoteAddress || '';
        if (req.headers && req.headers['x-forwarded-for']) {
            clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
        }

        const result = await authenticateSsoUser(ssoPayload, { ip: clientIp });

        console.log('[Auth] Microsoft callback login successful for:', ssoPayload.email);
        return res.send(buildCallbackHtml(true, result.token, result.user, null));

    } catch (error) {
        const msData = error.response?.data;
        console.error('[Auth] Microsoft callback failed:', msData || error.message);
        const detailMsg = msData?.error_description || msData?.error || error.message || 'Microsoft authentication failed';
        return res.send(buildCallbackHtml(false, null, null, detailMsg));
    }
};

/**
 * Build HTML response for the Microsoft OAuth callback popup.
 * Sends the auth result to the opener window via postMessage and closes the popup.
 */
function buildCallbackHtml(success, token, user, errorMsg) {
    const payload = JSON.stringify({ success, token, user, error: errorMsg });
    return `<!DOCTYPE html>
<html><head><title>Microsoft Login</title></head>
<body>
<p style="font-family:sans-serif;text-align:center;margin-top:40px;">
  ${success ? 'Login successful! Redirecting...' : 'Login failed. Closing...'}
</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'MICROSOFT_SSO_CALLBACK', payload: ${payload} }, '*');
      setTimeout(function() { window.close(); }, 500);
    } else {
      // Not a popup — redirect to frontend with result
      var origin = window.location.origin;
      var result = encodeURIComponent(JSON.stringify(${payload}));
      window.location.href = origin + '/login?ms_auth=' + result;
    }
  } catch(e) {
    document.body.innerHTML = '<p style="font-family:sans-serif;text-align:center;color:red;">Error: ' + e.message + '</p>';
  }
</script>
</body></html>`;
}
