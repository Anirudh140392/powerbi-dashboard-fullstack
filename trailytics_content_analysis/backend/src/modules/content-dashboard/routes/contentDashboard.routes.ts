import { Router } from 'express';
import { getContentDashboard } from '../controllers/contentDashboard.controller.js';

const router = Router();

// GET /api/content-dashboard
// Query params: company, platform, page, limit, search, sortBy, sortOrder
router.get('/', getContentDashboard);

export default router;
