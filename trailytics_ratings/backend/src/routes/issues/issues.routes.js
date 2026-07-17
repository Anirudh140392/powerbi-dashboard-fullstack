import express from 'express';
import { 
    getAsinIssues,
    getIssuesBreakdown,
    getIssueDetail,
    getReviewsByIssue,
    getIssueStatuses,
    createIssueStatus,
    getIssueDrilldown
} from '../../controllers/issues/issues.controller.js';

const router = express.Router();

router.get('/asin-issues', getAsinIssues);
router.get('/issues-breakdown', getIssuesBreakdown);
router.get('/issue-detail', getIssueDetail);
router.get('/reviews-by-issue', getReviewsByIssue);
router.get('/issue-statuses', getIssueStatuses);
router.post('/issue-statuses', createIssueStatus);
router.get('/issue/:name/drilldown', getIssueDrilldown);

export default router;
