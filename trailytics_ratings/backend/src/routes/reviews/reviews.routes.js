import express from 'express';
import { useOlapTable } from '../../utils/olapResolver.js';

import {
    getReviews as getReviewsLegacy,
    searchReviews as searchReviewsLegacy,
} from '../../controllers/reviews/reviews.controller.js';

import {
    getReviews as getReviewsOlap,
    searchReviews as searchReviewsOlap,
} from '../../controllers/reviews/reviews.olap.controller.js';

const dispatch = (legacyFn, olapFn) => (req, res, next) => {
    const dbName =
        req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] ||
        (req.authUser && req.authUser.dbName) ||
        process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || '';
    return useOlapTable(dbName) ? olapFn(req, res, next) : legacyFn(req, res, next);
};

const router = express.Router();

router.get('/reviews',        dispatch(getReviewsLegacy,       getReviewsOlap));
router.get('/reviews/search', dispatch(searchReviewsLegacy,    searchReviewsOlap));

export default router;
