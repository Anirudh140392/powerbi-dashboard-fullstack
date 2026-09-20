import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';

/**
 * Verify JWT token and return decoded payload
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        throw new Error('Invalid or expired token');
    }
}
