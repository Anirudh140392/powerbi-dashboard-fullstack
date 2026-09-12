import express from 'express';
import { useOlapTable } from '../../utils/olapResolver.js';

// Legacy multi-table controllers
import {
    getSummary as getSummaryLegacy,
    getTrends as getTrendsLegacy,
    getTimeline as getTimelineLegacy,
    getRatingTrend as getRatingTrendLegacy,
    getExecutiveHealth as getExecutiveHealthLegacy,
    getRatingMismatch as getRatingMismatchLegacy,
    getReviewTimeline as getReviewTimelineLegacy,
    getPriceVariance as getPriceVarianceLegacy,
    getProductHealth as getProductHealthLegacy,
    getCategoryHealth as getCategoryHealthLegacy,
    getBenchmarkData as getBenchmarkDataLegacy,
    getStarDistribution as getStarDistributionLegacy,
} from '../../controllers/overview/overview.controller.js';

// OLAP single-table controllers (rb_review_olap)
import {
    getSummary as getSummaryOlap,
    getTrends as getTrendsOlap,
    getTimeline as getTimelineOlap,
    getRatingTrend as getRatingTrendOlap,
    getExecutiveHealth as getExecutiveHealthOlap,
    getRatingMismatch as getRatingMismatchOlap,
    getReviewTimeline as getReviewTimelineOlap,
    getPriceVariance as getPriceVarianceOlap,
    getProductHealth as getProductHealthOlap,
    getCategoryHealth as getCategoryHealthOlap,
    getBenchmarkData as getBenchmarkDataOlap,
    getStarDistribution as getStarDistributionOlap,
} from '../../controllers/overview/overview.olap.controller.js';

/**
 * Returns a handler that dispatches to the OLAP controller if the logged-in
 * db is in OLAP_ENABLED_DBS, otherwise falls back to the legacy controller.
 */
const dispatch = (legacyFn, olapFn) => (req, res, next) => {
    const dbName =
        req.query.db_name ||
        req.headers['x-db-name'] ||
        req.headers['x-database-name'] ||
        (req.authUser && req.authUser.dbName) ||
        process.env.CLICKHOUSE_DATABASE ||
        process.env.CLICKHOUSE_DB ||
        '';

    if (useOlapTable(dbName)) {
        return olapFn(req, res, next);
    }
    return legacyFn(req, res, next);
};

const router = express.Router();

router.get('/summary',          dispatch(getSummaryLegacy,           getSummaryOlap));
router.get('/trends',           dispatch(getTrendsLegacy,            getTrendsOlap));
router.get('/timeline',         dispatch(getTimelineLegacy,          getTimelineOlap));
router.get('/rating-trend',     dispatch(getRatingTrendLegacy,       getRatingTrendOlap));
router.get('/executive-health', dispatch(getExecutiveHealthLegacy,   getExecutiveHealthOlap));
router.get('/rating-mismatch',  dispatch(getRatingMismatchLegacy,    getRatingMismatchOlap));
router.get('/review-timeline',  dispatch(getReviewTimelineLegacy,    getReviewTimelineOlap));
router.get('/price-variance',   dispatch(getPriceVarianceLegacy,     getPriceVarianceOlap));
router.get('/product-health',   dispatch(getProductHealthLegacy,     getProductHealthOlap));
router.get('/category-health',  dispatch(getCategoryHealthLegacy,    getCategoryHealthOlap));
router.get('/benchmark-data',   dispatch(getBenchmarkDataLegacy,     getBenchmarkDataOlap));
router.get('/star-distribution',dispatch(getStarDistributionLegacy,  getStarDistributionOlap));

export default router;

