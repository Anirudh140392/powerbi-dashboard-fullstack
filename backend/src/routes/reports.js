import { getReportFilterOptions, downloadReport, getAvailableReportTypes, getReportBuilderOptions, getPdpReportFilters, downloadPdpReport } from '../controllers/reportsController.js';

export default (app) => {
    app.get('/api/reports/filter-options', getReportFilterOptions);
    app.get('/api/reports/builder-options', getReportBuilderOptions);
    app.get('/api/reports/available-types', getAvailableReportTypes);
    app.get('/api/reports/download', downloadReport);
    app.get('/api/reports/pdp-report-filters', getPdpReportFilters);
    app.get('/api/reports/download-pdp-report', downloadPdpReport);
};
