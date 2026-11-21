import {
    createTemplateHandler, deleteTemplateHandler, listTemplatesHandler, markTemplateUsedHandler, updateTemplateHandler,
} from '../controllers/reportTemplateController.js';

// Report Studio templates users save.
export default (app) => {
    app.get('/api/report-templates', listTemplatesHandler);
    app.post('/api/report-templates', createTemplateHandler);
    app.put('/api/report-templates/:id', updateTemplateHandler);
    app.delete('/api/report-templates/:id', deleteTemplateHandler);
    app.post('/api/report-templates/:id/used', markTemplateUsedHandler);
};
