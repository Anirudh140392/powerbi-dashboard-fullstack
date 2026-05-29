// src/routes/auth.js
import express from 'express';
import { login, verify } from '../controllers/authController.js';

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

export default router;

