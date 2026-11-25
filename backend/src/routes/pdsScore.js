import { getPdsScoreOverview, getPdsScoreTable } from '../controllers/pdsScoreController.js';

export default (app) => {
    app.get('/api/pds-score/overview', getPdsScoreOverview);
    app.get('/api/pds-score/table', getPdsScoreTable);
    app.get('/api/pds-score', getPdsScoreOverview);
};

