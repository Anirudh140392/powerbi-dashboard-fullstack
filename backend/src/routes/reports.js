import { getReportFilterOptions, downloadReport } from '../controllers/reportsController.js';

export default (app) => {
    app.get('/api/reports/filter-options', getReportFilterOptions);
    app.get('/api/reports/download', downloadReport);
};
