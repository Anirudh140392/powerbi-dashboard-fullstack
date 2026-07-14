import express from 'express';
import cors from 'cors';

const app = express();

// Middlewares will be initialized here in the new architecture
// Note: legacyApi already handles some middleware internally (like cors, body-parser)

import { authenticateApi } from './middleware/auth.middleware.js';

// Mount modular routes here
import routes from './routes/index.js';
app.use('/api', authenticateApi, routes);

export default app;
