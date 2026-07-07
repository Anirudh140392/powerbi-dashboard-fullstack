// src/routes/auth.js
import express from 'express';
import { login, verify, ratingssSsoToken } from '../controllers/authController.js';
import { authMiddleware } from '../helper/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with email and password, returns JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful login
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify session
 *     description: Re-validates JWT token and checks current access permissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session valid, returns user data
 *       401:
 *         description: Invalid/expired token or access revoked
 */
router.get('/verify', verify);

/**
 * GET /api/auth/ratings-sso-token
 * Protected — requires valid DS JWT.
 * Generates a short-lived (60s) HMAC-SHA256 token containing the user's email.
 * The ratings backend (/api/auth/sso) validates and exchanges it for a full
 * ratings session, enabling single sign-on from Digital Shelf → Ratings.
 */
router.get('/ratings-sso-token', authMiddleware, ratingssSsoToken);

export default router;
