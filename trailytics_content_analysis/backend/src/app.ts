import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './modules/content-dashboard/routes/auth.route.js';
import { contentDashboardRouter } from './modules/content-dashboard/index.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/content-dashboard", contentDashboardRouter);







// health check api 
app.get("/health", (req, res) => {
    res.send("Server is running");
});

export default app;