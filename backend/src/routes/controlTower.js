import { watchTowerOverview } from '../controllers/watchTowerController.js';

export default (app) => {
    // watchTowerOverview
    app.get('/api/watchtower', watchTowerOverview);
    
};
