import { getMopFilters, getMopData, getMopLatestDate } from '../controllers/mopAnalysisController.js';

export default (app) => {
    app.get('/api/mop-analysis/latest-date', getMopLatestDate);
    app.get('/api/mop-analysis/filters', getMopFilters);
    app.get('/api/mop-analysis/data', getMopData);
};

