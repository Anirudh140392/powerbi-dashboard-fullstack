import { getReportFilterOptions, downloadReport, getAvailableReportTypes } from '../controllers/reportsController.js';

export default (app) => {
    app.get('/api/reports/filter-options', getReportFilterOptions);
    app.get('/api/reports/available-types', getAvailableReportTypes);
    app.get('/api/reports/download', downloadReport);
};
