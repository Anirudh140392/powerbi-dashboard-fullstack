import { getDashboardData } from '../controllers/dashboardController.js';

export default (app) => {
    app.get('/api/dashboard', getDashboardData);
};
