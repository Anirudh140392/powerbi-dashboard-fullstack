import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
            : [];
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "Expires"]
};

app.use(cors(corsOptions));

// Middlewares will be initialized here in the new architecture
// Note: legacyApi already handles some middleware internally (like cors, body-parser)

import { clickhouseStorage, resolveCompanyUuid } from './config/clickhouse.js';

// Resolve dynamic company context and database name
app.use(async (req, res, next) => {
    const dbName = req.query.db_name || req.headers['x-db-name'] || process.env.CLICKHOUSE_DB || 'prestige';
    const companyId = await resolveCompanyUuid(dbName);

    req.companyId = companyId;
    req.dbName = dbName;

    clickhouseStorage.run({ dbName, companyId }, () => {
        next();
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Mount modular routes here
import routes from './routes/index.js';
app.use('/api', routes);

export default app;
