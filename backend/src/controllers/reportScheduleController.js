import { verifyToken } from '../services/authService.js';
import { isAdmin, resolveDbId, userEmail } from '../helper/workspaceHelper.js';
import {
    createSchedule, getSchedule, listSchedules, removeRecipient, ScheduleValidationError,
    setScheduleStatus, toClient, updateSchedule,
} from '../services/reportScheduleService.js';
import { deliverSchedule } from '../services/reportScheduleCronService.js';

/** The schedule, if it belongs to the user's workspace and they may change it (its owner or an admin). */
const loadManageable = async (req, res) => {
    const [schedule, dbId] = await Promise.all([getSchedule(req.params.id), resolveDbId(req.user)]);
    if (!schedule || schedule.db_id !== dbId) {
        res.status(404).json({ success: false, error: 'Schedule not found' });
        return null;
    }
    if (schedule.created_by !== userEmail(req.user) && !isAdmin(req.user)) {
        res.status(403).json({ success: false, error: 'Only the person who created this schedule or an admin can change it' });
        return null;
    }
    return schedule;
};

const handleError = (res, label, error) => {
    if (error instanceof ScheduleValidationError) return res.status(400).json({ success: false, error: error.message });
    console.error(`[ReportSchedule] ${label} failed:`, error.message);
    return res.status(500).json({ success: false, error: `Failed to ${label}` });
};

/** GET /api/report-schedules */
export const listSchedulesHandler = async (req, res) => {
    try {
        const dbId = await resolveDbId(req.user);
        if (!dbId) return res.status(400).json({ success: false, error: 'No workspace selected' });
        const schedules = await listSchedules(dbId);
        res.json({ success: true, data: schedules.map(toClient) });
    } catch (error) {
        handleError(res, 'load schedules', error);
    }
};

/** POST /api/report-schedules */
export const createScheduleHandler = async (req, res) => {
    try {
        const dbId = await resolveDbId(req.user);
        if (!dbId) return res.status(400).json({ success: false, error: 'No workspace selected' });
        const schedule = await createSchedule({ user: req.user, dbId, body: req.body });
        res.status(201).json({ success: true, data: toClient(schedule) });
    } catch (error) {
        handleError(res, 'create the schedule', error);
    }
};

/** PUT /api/report-schedules/:id */
export const updateScheduleHandler = async (req, res) => {
    try {
        const schedule = await loadManageable(req, res);
        if (!schedule) return;
        res.json({ success: true, data: toClient(await updateSchedule(schedule, req.body)) });
    } catch (error) {
        handleError(res, 'update the schedule', error);
    }
};

/** PATCH /api/report-schedules/:id/status — { status: 'active' | 'paused' } */
export const setScheduleStatusHandler = async (req, res) => {
    try {
        const { status } = req.body || {};
        if (!['active', 'paused'].includes(status)) return res.status(400).json({ success: false, error: 'Status must be active or paused' });
        const schedule = await loadManageable(req, res);
        if (!schedule) return;
        if (status === 'active' && !schedule.recipients.length) {
            return res.status(400).json({ success: false, error: 'Add a recipient before resuming' });
        }
        res.json({ success: true, data: toClient(await setScheduleStatus(schedule, status)) });
    } catch (error) {
        handleError(res, 'update the schedule', error);
    }
};

/** DELETE /api/report-schedules/:id */
export const deleteScheduleHandler = async (req, res) => {
    try {
        const schedule = await loadManageable(req, res);
        if (!schedule) return;
        await setScheduleStatus(schedule, 'deleted');
        res.json({ success: true });
    } catch (error) {
        handleError(res, 'delete the schedule', error);
    }
};

/** POST /api/report-schedules/:id/send — sends the report now, outside the schedule. */
export const sendScheduleNowHandler = async (req, res) => {
    try {
        const schedule = await loadManageable(req, res);
        if (!schedule) return;
        if (!schedule.recipients.length) return res.status(400).json({ success: false, error: 'The schedule has no recipients' });
        const result = await deliverSchedule(schedule);
        if (result.status === 'failed') return res.status(502).json({ success: false, error: result.error });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[ReportSchedule] Send now failed:', error.message);
        res.status(502).json({ success: false, error: error.message });
    }
};

const unsubscribePage = (title, body) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:48px 16px;background:#f4f7fb;font-family:Arial,sans-serif;color:#111827;">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #d7e6ff;padding:24px;">
<div style="color:#4b74c9;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Scheduled Reports</div>
<h1 style="font-size:18px;margin:12px 0 8px;">${title}</h1>
<p style="font-size:14px;line-height:20px;color:#475569;margin:0;">${body}</p>
</div></body></html>`;

const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** GET /api/report-schedules/unsubscribe?token= — public; the token in each email names the schedule and recipient. */
export const unsubscribeHandler = async (req, res) => {
    let claims;
    try {
        claims = verifyToken(String(req.query.token || ''));
    } catch {
        claims = null;
    }
    if (claims?.purpose !== 'report-unsubscribe') {
        return res.status(400).send(unsubscribePage('Link not valid', 'This unsubscribe link is broken or incomplete. Use the link from the latest report email.'));
    }
    try {
        const schedule = await getSchedule(claims.sid);
        if (schedule && schedule.recipients.includes(claims.email)) await removeRecipient(schedule, claims.email);
        const name = schedule ? `“${escapeHtml(schedule.name)}”` : 'this report';
        res.send(unsubscribePage('You’ve been unsubscribed', `${escapeHtml(claims.email)} will no longer receive ${name}.`));
    } catch (error) {
        console.error('[ReportSchedule] Unsubscribe failed:', error.message);
        res.status(500).send(unsubscribePage('Something went wrong', 'We couldn’t unsubscribe you just now. Please try the link again later.'));
    }
};
