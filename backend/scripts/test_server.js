import { config } from 'dotenv';
config({ path: '/home/asus/Music/powerbi-dashboard-fullstack/backend/.env' });

import express from 'express';
import performanceMarketingRoutes from './src/routes/performanceMarketing.js';

const app = express();
// Mock req.user for currentDbName parsing
app.use((req, res, next) => {
    req.user = { tenantId: 'rb' }; // Sets dbName to mars
    next();
});

performanceMarketingRoutes(app);

app.listen(9501, () => {
    console.log("Test server running on 9501");
});
