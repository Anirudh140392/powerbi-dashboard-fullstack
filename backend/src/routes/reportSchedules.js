import {
    createScheduleHandler, deleteScheduleHandler, listSchedulesHandler,
    sendScheduleNowHandler, setScheduleStatusHandler, updateScheduleHandler,
} from '../controllers/reportScheduleController.js';

// Scheduled report emails. The public unsubscribe link is registered in app.js, ahead of the JWT check.
export default (app) => {
    app.get('/api/report-schedules', listSchedulesHandler);
    app.post('/api/report-schedules', createScheduleHandler);
    app.put('/api/report-schedules/:id', updateScheduleHandler);
    app.patch('/api/report-schedules/:id/status', setScheduleStatusHandler);
    app.delete('/api/report-schedules/:id', deleteScheduleHandler);
    app.post('/api/report-schedules/:id/send', sendScheduleNowHandler);
};
