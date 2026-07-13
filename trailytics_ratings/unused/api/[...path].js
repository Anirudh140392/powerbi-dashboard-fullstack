/**
 * Vercel Serverless Function — catch-all handler for /api/*
 * Uses createRequire to load CommonJS Express app from ESM context.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const app = require('../server/api.cjs');

export default async function handler(req, res) {
    try {
        await app(req, res);
    } catch (err) {
        console.error('Serverless handler error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error', details: err.message });
        }
    }
}
