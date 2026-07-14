import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS, // ← THIS ONE
    credentials: true, // If you need cookies / auth headers passed
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "Expires"]
};

app.use(cors(corsOptions));

// Middlewares will be initialized here in the new architecture
// Note: legacyApi already handles some middleware internally (like cors, body-parser)

// Remove authentication and hardcode the company context from .env
app.use((req, res, next) => {
    req.companyId = process.env.COMPANY_ID;
    next();
});

// Mount modular routes here
import routes from './routes/index.js';
app.use('/api', routes);

export default app;
