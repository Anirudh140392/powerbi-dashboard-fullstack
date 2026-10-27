import express from 'express';
import { 
    getAlertRules,
    createAlertRule,
    updateAlertRule,
    deleteAlertRule,
    testAlertRule,
    getAlertEvents,
    getAutomationStatus,
    getAutomationRuns,
    triggerAutomation,
    getKnownJobs,
    getRecentJobs,
    getJobStatus,
    triggerJob,
    getMailerSettings,
    sendWeeklyDigest,
    getTrainingSetStats,
    exportTrainingSet,
    updateMailerSettings,
    testMail,
    triggerStage,
    cancelJob
} from '../../controllers/automation/automation.controller.js';

const router = express.Router();

router.get('/alert-rules', getAlertRules);
router.post('/alert-rules', createAlertRule);
router.put('/alert-rules/:id', updateAlertRule);
router.delete('/alert-rules/:id', deleteAlertRule);
router.post('/alert-rules/:id/test', testAlertRule);
router.get('/alert-events', getAlertEvents);
router.get('/status', getAutomationStatus);
router.get('/runs', getAutomationRuns);
router.post('/trigger', triggerAutomation);
router.get('/jobs/known', getKnownJobs);
router.get('/jobs/recent', getRecentJobs);
router.get('/jobs/:id', getJobStatus);
router.post('/jobs/trigger', triggerJob);
router.get('/mailer-settings', getMailerSettings);
router.post('/weekly-digest/send', sendWeeklyDigest);
router.get('/training-set/stats', getTrainingSetStats);
router.get('/training-set/export', exportTrainingSet);
router.put('/mailer-settings', updateMailerSettings);
router.post('/test-mail', testMail);
router.post('/trigger-stage', triggerStage);
router.post('/jobs/:id/cancel', cancelJob);

export default router;
