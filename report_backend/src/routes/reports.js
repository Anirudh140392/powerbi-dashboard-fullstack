import express from 'express';
import {
    getReportFilterOptions, downloadReport, getAvailableReportTypes,
    getReportBuilderOptions, getPdpReportFilters, downloadPdpReport,
    previewPdpReport, getPromoViolationFilterOptions,
    downloadPromoViolationReport, previewPromoViolationReport
} from '../controllers/reportsController.js';
import { authMiddleware } from '../helper/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/filter-options', getReportFilterOptions);
router.get('/builder-options', getReportBuilderOptions);
router.get('/available-types', getAvailableReportTypes);
router.get('/download', downloadReport);
router.get('/pdp-report-filters', getPdpReportFilters);
router.get('/download-pdp-report', downloadPdpReport);
router.get('/preview-pdp-report', previewPdpReport);
router.get('/promo-violation-filters', getPromoViolationFilterOptions);
router.get('/download-promo-violation-report', downloadPromoViolationReport);
router.get('/preview-promo-violation-report', previewPromoViolationReport);

export default router;
