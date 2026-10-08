// src/routes/whatsappWebhookRoutes.js
// Express routes for Meta WhatsApp Webhook handling

import express from 'express';
import { verifyWebhook, handleWebhookEvent } from '../controllers/whatsappWebhookController.js';

const router = express.Router();

// GET /api/whatsapp/webhook - Webhook Verification Challenge from Meta
router.get('/', verifyWebhook);

// POST /api/whatsapp/webhook - Real-time Status Updates (sent, delivered, read, failed)
router.post('/', handleWebhookEvent);

export default router;
