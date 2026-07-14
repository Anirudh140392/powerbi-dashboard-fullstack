import express from 'express';
import { 
    getSummary,
    getTrends,
    getTimeline,
    getRatingTrend,
    getExecutiveHealth,
    getRatingMismatch,
    getReviewTimeline,
    getPriceVariance
} from '../../controllers/overview/overview.controller.js';

const router = express.Router();

router.get('/summary', getSummary);
router.get('/trends', getTrends);
router.get('/timeline', getTimeline);
router.get('/rating-trend', getRatingTrend);
router.get('/executive-health', getExecutiveHealth);
router.get('/rating-mismatch', getRatingMismatch);
router.get('/review-timeline', getReviewTimeline);
router.get('/price-variance', getPriceVariance);

import { getProductHealth, getCategoryHealth, getBenchmarkData } from '../../controllers/misc_temp.js';
router.get('/product-health', getProductHealth);
router.get('/category-health', getCategoryHealth);
router.get('/benchmark-data', getBenchmarkData);

export default router;
