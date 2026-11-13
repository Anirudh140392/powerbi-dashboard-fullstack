import express from 'express';
import overviewRoutes from './overview/overview.routes.js';
import categoryRoutes from './category/category.routes.js';
import competitionRoutes from './competition/competition.routes.js';
import issuesRoutes from './issues/issues.routes.js';
import reviewsRoutes from './reviews/reviews.routes.js';
import mlRoutes from './ml/ml.routes.js';
import automationRoutes from './automation/automation.routes.js';
import datalakeRoutes from './datalake/datalake.routes.js';
import auditRoutes from './ml/audit.routes.js';
import configRoutes from './config/config.routes.js';
import stakeholderRoutes from './stakeholder/stakeholder.routes.js';
import notificationsRoutes from './notifications/notifications.routes.js';

const router = express.Router();

router.use('/ratings', overviewRoutes);
router.use('/ratings', categoryRoutes);
router.use('/ratings', competitionRoutes);
router.use('/ratings', issuesRoutes);
router.use('/ratings', reviewsRoutes);
router.use('/ratings', configRoutes);
router.use('/ratings', stakeholderRoutes);
router.use('/ml', mlRoutes);
router.use('/ml-audit', auditRoutes);
router.use('/automation', automationRoutes);
router.use('/data-lake', datalakeRoutes);
router.use('/notifications', notificationsRoutes);

export default router;
