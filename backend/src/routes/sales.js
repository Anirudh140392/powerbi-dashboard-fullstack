import { getSalesOverview } from '../controllers/salesController.js';

export default (app) => {
    app.get('/api/sales/overview', getSalesOverview);
};
