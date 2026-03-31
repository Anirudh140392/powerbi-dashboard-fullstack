// src/controllers/authController.js
import { loginUser } from '../services/authService.js';

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { email, name, dbName } }
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }

        const result = await loginUser(email, password);

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
