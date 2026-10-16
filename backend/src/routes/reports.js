import {
    getReportFilterOptions, downloadReport, getAvailableReportTypes,
    getReportBuilderOptions, getPdpReportFilters, downloadPdpReport,
    previewPdpReport, getPromoViolationFilterOptions,
    downloadPromoViolationReport, previewPromoViolationReport
} from '../controllers/reportsController.js';

export default (app) => {
    app.get('/api/reports/filter-options', getReportFilterOptions);
    app.get('/api/reports/builder-options', getReportBuilderOptions);
    app.get('/api/reports/available-types', getAvailableReportTypes);
    app.get('/api/reports/download', downloadReport);
    app.get('/api/reports/pdp-report-filters', getPdpReportFilters);
    app.get('/api/reports/download-pdp-report', downloadPdpReport);
    app.get('/api/reports/preview-pdp-report', previewPdpReport);
    app.get('/api/reports/promo-violation-filters', getPromoViolationFilterOptions);
    app.get('/api/reports/download-promo-violation-report', downloadPromoViolationReport);
    app.get('/api/reports/preview-promo-violation-report', previewPromoViolationReport);
};

