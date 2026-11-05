import { Router } from 'express';
import { getContentDashboard } from '../controllers/contentDashboard.controller.js';
import { getFilters, getSkus } from '../controllers/filters.controller.js';

const router = Router();

// GET /api/content-dashboard
// Query params: company, platform, page, limit, search, sortBy, sortOrder
router.get('/', getContentDashboard);

// GET /api/content-dashboard/filters
router.get('/cascaded-filters', getFilters);

// GET /api/content-dashboard/skus
router.get('/skus-search', getSkus);

export default router;
