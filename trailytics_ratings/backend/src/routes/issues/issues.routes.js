import express from 'express';
import { useOlapTable } from '../../utils/olapResolver.js';

import {
    getAsinIssues as getAsinIssuesLegacy,
    getIssuesBreakdown as getIssuesBreakdownLegacy,
    getIssueDetail as getIssueDetailLegacy,
    getReviewsByIssue as getReviewsByIssueLegacy,
    getIssueStatuses,
    createIssueStatus,
    getIssueDrilldown,
} from '../../controllers/issues/issues.controller.js';

import {
    getAsinIssues as getAsinIssuesOlap,
    getIssuesBreakdown as getIssuesBreakdownOlap,
    getIssueDetail as getIssueDetailOlap,
    getReviewsByIssue as getReviewsByIssueOlap,
} from '../../controllers/issues/issues.olap.controller.js';

const dispatch = (legacyFn, olapFn) => (req, res, next) => {
    const dbName =
        req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] ||
        (req.authUser && req.authUser.dbName) ||
        process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || '';
    return useOlapTable(dbName) ? olapFn(req, res, next) : legacyFn(req, res, next);
};

const router = express.Router();

router.get('/asin-issues',       dispatch(getAsinIssuesLegacy,       getAsinIssuesOlap));
router.get('/issues-breakdown',  dispatch(getIssuesBreakdownLegacy,  getIssuesBreakdownOlap));
router.get('/issue-detail',      dispatch(getIssueDetailLegacy,      getIssueDetailOlap));
router.get('/reviews-by-issue',  dispatch(getReviewsByIssueLegacy,   getReviewsByIssueOlap));
// Statuses are Postgres-only — no dispatch
router.get('/issue-statuses',               getIssueStatuses);
router.post('/issue-statuses',              createIssueStatus);
router.get('/issue/:name/drilldown',        getIssueDrilldown);

export default router;
