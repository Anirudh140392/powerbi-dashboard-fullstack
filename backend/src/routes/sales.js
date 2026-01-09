import { getSalesOverview, getSalesDrilldown, getCategorySalesMatrix, getSalesTrends, getSalesFilterOptions } from '../controllers/salesController.js';

export default (app) => {
    app.get('/api/sales/overview', getSalesOverview);
    app.get('/api/sales/drilldown', getSalesDrilldown);
    app.get('/api/sales/category-matrix', getCategorySalesMatrix);
    app.get('/api/sales/trends', getSalesTrends);
    app.get('/api/sales/filter-options', getSalesFilterOptions);
};
