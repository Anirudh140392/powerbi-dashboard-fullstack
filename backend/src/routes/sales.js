import { getSalesOverview, getSalesDrilldown, getCategorySalesMatrix, getSalesTrends, getSalesFilterOptions } from '../controllers/salesController.js';
import { getSalesVisibilitySignals, getSalesVisibilitySignalCityDetails } from '../controllers/salesSignalLabController.js';

export default (app) => {
    // Sales core endpoints
    app.get('/api/sales/overview', getSalesOverview);
    app.get('/api/sales/drilldown', getSalesDrilldown);
    app.get('/api/sales/category-matrix', getCategorySalesMatrix);
    app.get('/api/sales/trends', getSalesTrends);
    app.get('/api/sales/filter-options', getSalesFilterOptions);

    // Sales Visibility Signals endpoints (moved from visibility-analysis)
    app.get('/api/sales/visibility-signals', getSalesVisibilitySignals);
    app.get('/api/sales/visibility-signals/city-details', getSalesVisibilitySignalCityDetails);
};
