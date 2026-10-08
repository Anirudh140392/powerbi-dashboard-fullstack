import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cluster from 'node:cluster';
import os from 'node:os';
import reportsRouter from './routes/reports.js';
import { asyncStorageMiddleware } from './config/clickhouse.js';

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration
app.use(cors());

// Parse JSON and urlencoded body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Wrap request in AsyncLocalStorage context for tenant DB scoping
app.use(asyncStorageMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'report_backend', port: PORT, pid: process.pid });
});

// Reports routes under /api/reports
app.use('/api/reports', reportsRouter);

// Start server with process clustering for multi-core parallel handling
const numWorkers = process.env.WORKERS 
    ? parseInt(process.env.WORKERS, 10) 
    : Math.min(os.availableParallelism ? os.availableParallelism() : os.cpus().length, 4);

if (cluster.isPrimary && numWorkers > 1 && process.env.DISABLE_CLUSTER !== 'true') {
    console.log(`⚡ Primary process ${process.pid} is running. Spawning ${numWorkers} report backend worker processes...`);
    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        console.warn(`⚠️ Report worker ${worker.process.pid} exited (code ${code}). Forking replacement worker...`);
        cluster.fork();
    });
} else {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Report Backend Worker ${process.pid} listening on port ${PORT}`);
    });
}

export default app;

