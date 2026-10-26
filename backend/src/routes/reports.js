import {
    getReportFilterOptions, downloadReport, getAvailableReportTypes,
    getReportBuilderOptions, getPdpReportFilters, downloadPdpReport,
    previewPdpReport, getPromoViolationFilterOptions,
    downloadPromoViolationReport, previewPromoViolationReport,
    getPriceViolationFilterOptions, downloadPriceViolationReport,
    previewPriceViolationReport, proxyReportStudio
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
    app.get('/api/reports/price-violation-filters', getPriceViolationFilterOptions);
    app.get('/api/reports/download-price-violation-report', downloadPriceViolationReport);
    app.get('/api/reports/preview-price-violation-report', previewPriceViolationReport);
    app.get('/api/reports/studio/:action', proxyReportStudio);
};

