import express from 'express';
import {
    inspectProduct,
    getPendingAudit,
    approveAudit,
    rejectAudit,
    bulkTriggerAudit
} from '../../controllers/ml/audit.controller.js';

const router = express.Router();

router.post('/product-inspect', inspectProduct);
router.get('/pending', getPendingAudit);
router.post('/approve', approveAudit);
router.post('/reject', rejectAudit);
router.post('/bulk-trigger', bulkTriggerAudit);

export default router;
