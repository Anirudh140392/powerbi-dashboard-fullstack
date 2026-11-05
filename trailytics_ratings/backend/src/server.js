import app from './app.js';
import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the React dist directory if not on Vercel
if (!process.env.VERCEL) {
    app.use(express.static(path.join(__dirname, '../../frontend/dist')));
    
    // Catch-all route to serve index.html for React Router (skip API routes)
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(__dirname, '../../frontend/dist', 'index.html'));
    });

    const PORT = process.env.PORT || process.env.API_PORT || 3001;
    app.listen(PORT, async () => {
        console.log(`Ratings Platform modular server running on port ${PORT}`);
        
        // Dynamically import pool to avoid top-level blocking if db fails early
        const { default: pool } = await import('./config/db.js');
        console.log(`  DB: ${pool.options.host}/${pool.options.database}`);
        
        // Reconcile orphaned ml jobs
        try {
            const spawnJob = await import('./automation/spawnJob.cjs');
            if (spawnJob.reconcileOrphanedJobs) {
                spawnJob.reconcileOrphanedJobs({ pool, reason: 'api server restarted' }).catch(e =>
                    console.error('[ml-jobs] reconcile failed:', e.message)
                );
            }
        } catch (e) {
            console.error('[ml-jobs] reconcile import failed:', e.message);
        }

        // Boot cache pre-warmer
        if (!process.env.INTERNAL_PREWARM_TOKEN) {
            const crypto = await import('crypto');
            process.env.INTERNAL_PREWARM_TOKEN = crypto.randomBytes(32).toString('hex');
        }
        try {
            const prewarmer = await import('./cachePrewarmer.cjs');
            if (prewarmer.start) {
                prewarmer.start({ port: PORT, pool, internalToken: process.env.INTERNAL_PREWARM_TOKEN });
            }
        } catch (e) {
            console.error('[prewarm] failed to start:', e.message);
        }
    });
}
