import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
    res.status(200).json({ status: 'OK', service: 'report_backend', port: PORT });
});

// Reports routes under /api/reports
app.use('/api/reports', reportsRouter);

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Report Backend Microservice running on port ${PORT}`);
});

export default app;
