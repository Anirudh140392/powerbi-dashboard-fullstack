// src/controllers/authController.js
import { loginUser, verifySession } from '../services/authService.js';

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { email, name, dbName } }
 */
export const login = async (req, res) => {
    try {
        const { email, password, publicIp } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }
        // Use client-provided public IP if available, otherwise fallback to network IP
        let clientIp = publicIp;
        if (!clientIp) {
            clientIp = req.ip || req.socket?.remoteAddress || '';
            if (req.headers['x-forwarded-for']) {
                clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
            }

            // Clean up formatting for local loopback and IPv4-mapped IPv6
            if (clientIp === '::1') {
                clientIp = '127.0.0.1';
            } else if (clientIp.startsWith('::ffff:')) {
                clientIp = clientIp.substring(7);
            }
        }
        
        const result = await loginUser(email, password, clientIp);

        return res.status(200).json({
            success: true,
            token: result.token,
            user: result.user,
        });
    } catch (error) {
        console.error('[Auth] Login failed:', error.message);
        return res.status(401).json({
            success: false,
            error: error.message || 'Invalid email or password',
        });
    }
};

/**
 * GET /api/auth/verify
 * Headers: Authorization: Bearer <token>
 * Returns: { success: true, user: { email, name, dbName, role } }
 * 
 * Re-validates the JWT token and checks current access permissions.
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
        const userData = await verifySession(token);

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

