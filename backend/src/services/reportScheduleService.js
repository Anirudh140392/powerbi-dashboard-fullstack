// src/services/reportScheduleService.js
// Scheduled report emails, stored in admin_master.tb_report_schedule.
//
// One row per schedule in a ReplacingMergeTree: every change (edit, pause,
// delivery status) inserts the whole row again with a higher `version`, and
// reads use FINAL to see the latest. The last delivery is kept on the row
// itself (last_period / last_status / attempts), which is what stops a
// schedule from sending twice — see isDue in reportScheduleTiming.js.
import crypto from 'crypto';
import { insertAdminDB, queryAdminDB } from '../config/adminClickhouse.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { DATE_WINDOWS, FREQUENCIES, istNow, nextSendAt, slotPassedToday } from '../utils/reportScheduleTiming.js';

const TABLE = 'tb_report_schedule';
const MAX_RECIPIENTS = 20;
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const STUDIO_SOURCES = ['pdp', 'kw', 'ms', 'pm'];
const BRAND_SCOPES = ['own', 'all'];

export class ScheduleValidationError extends Error {}

let tableReady = null;

/** Creates the table on first use. */
export const ensureReportScheduleTable = () => {
    tableReady ??= queryAdminDB(`
        CREATE TABLE IF NOT EXISTS ${TABLE}
        (
            id               String,
            db_id            String,
            created_by       String,
            created_by_id    String,
            created_by_name  String,
            created_at       String,
            name             String,
            report_kind      LowCardinality(String),
            report_config    String,
            frequency        LowCardinality(String),
            day_of_week      UInt8,
            day_of_month     UInt8,
            send_time        String,
            date_window      LowCardinality(String),
            recipients       String,
            subject          String,
            message          String,
            format           LowCardinality(String),
            status           LowCardinality(String),
            last_period      String,
            last_status      LowCardinality(String),
            last_sent_at     String,
            last_error       String,
            attempts         UInt8,
            version          UInt64
        )
        ENGINE = ReplacingMergeTree(version)
        ORDER BY id
    `).catch((error) => {
        tableReady = null;
        throw error;
    });
    return tableReady;
};

const fromRow = (row) => ({
    ...row,
    report_config: JSON.parse(row.report_config || '{}'),
    recipients: (row.recipients ? decrypt(row.recipients) : '').split(',').filter(Boolean),
    day_of_week: Number(row.day_of_week),
    day_of_month: Number(row.day_of_month),
    attempts: Number(row.attempts),
    version: Number(row.version),
});

const toRow = (schedule) => ({
    ...schedule,
    report_config: JSON.stringify(schedule.report_config),
    recipients: encrypt(schedule.recipients.join(',')),
    // Strictly increasing, so a change written in the same millisecond still wins.
    version: Math.max(Date.now(), Number(schedule.version || 0) + 1),
});

/** Writes a new version of the schedule and returns it. */
const save = async (schedule) => {
    const row = toRow(schedule);
    await insertAdminDB(TABLE, [row]);
    return { ...schedule, version: row.version };
};

const SELECT = `SELECT * FROM ${TABLE} FINAL`;

/** The schedule as the API returns it, with its next send time. */
export const toClient = (schedule) => ({
    id: schedule.id,
    name: schedule.name,
    reportKind: schedule.report_kind,
    reportConfig: schedule.report_config,
    frequency: schedule.frequency,
    dayOfWeek: schedule.day_of_week,
    dayOfMonth: schedule.day_of_month,
    sendTime: schedule.send_time,
    dateWindow: schedule.date_window,
    recipients: schedule.recipients,
    subject: schedule.subject,
    message: schedule.message,
    format: schedule.format,
    status: schedule.status,
    createdBy: schedule.created_by,
    createdByName: schedule.created_by_name,
    createdAt: schedule.created_at,
    lastStatus: schedule.last_status,
    lastSentAt: schedule.last_sent_at,
    lastError: schedule.last_error,
    nextSendAt: nextSendAt(schedule),
});

export const listSchedules = async (dbId) => {
    await ensureReportScheduleTable();
    const rows = await queryAdminDB(
        `${SELECT} WHERE db_id = {dbId:String} AND status != 'deleted' ORDER BY created_at DESC`,
        { dbId }
    );
    return rows.map(fromRow);
};

export const listActiveSchedules = async () => {
    await ensureReportScheduleTable();
    const rows = await queryAdminDB(`${SELECT} WHERE status = 'active'`);
    return rows.map(fromRow);
};

export const getSchedule = async (id) => {
    await ensureReportScheduleTable();
    const [row] = await queryAdminDB(`${SELECT} WHERE id = {id:String} AND status != 'deleted' LIMIT 1`, { id });
    return row ? fromRow(row) : null;
};

/** Checks and normalises the editable fields of a create/update request body. */
const parseInput = (body) => {
    const fail = (message) => {
        throw new ScheduleValidationError(message);
    };
    const name = String(body.name || '').trim();
    if (!name) fail('Give the schedule a name.');
    if (name.length > 120) fail('Keep the name under 120 characters.');

    const frequency = String(body.frequency || '').toLowerCase();
    if (!FREQUENCIES.includes(frequency)) fail('Frequency must be daily, weekly or monthly.');
    const dayOfWeek = Number(body.dayOfWeek) || 0;
    const dayOfMonth = Number(body.dayOfMonth) || 0;
    if (frequency === 'weekly' && !(dayOfWeek >= 1 && dayOfWeek <= 7)) fail('Pick a day of the week.');
    if (frequency === 'monthly' && !(dayOfMonth >= 1 && dayOfMonth <= 31)) fail('Pick a day of the month.');

    const sendTime = String(body.sendTime || '');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) fail('Send time must be HH:mm.');
    const dateWindow = String(body.dateWindow || '');
    if (!DATE_WINDOWS[dateWindow]) fail('Pick the dates each report covers.');

    const recipients = [...new Set((Array.isArray(body.recipients) ? body.recipients : [])
        .map((email) => String(email).trim().toLowerCase())
        .filter(Boolean))];
    if (!recipients.length) fail('Add at least one recipient.');
    if (recipients.length > MAX_RECIPIENTS) fail(`Add at most ${MAX_RECIPIENTS} recipients.`);
    const invalid = recipients.find((email) => !EMAIL_PATTERN.test(email));
    if (invalid) fail(`"${invalid}" isn't a valid email address.`);

    // Only Report Studio reports can be scheduled so far.
    const config = body.reportConfig || {};
    const sources = Array.isArray(config.sources) ? config.sources.filter((s) => STUDIO_SOURCES.includes(s)) : [];
    const columns = Array.isArray(config.columns) ? config.columns.map(String).filter(Boolean) : [];
    if (!sources.length) fail('The report needs at least one data source.');
    if (!columns.length) fail('The report needs at least one column.');
    const brandScope = BRAND_SCOPES.includes(config.brandScope) ? config.brandScope : 'own';

    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    if (subject.length > 200) fail('Keep the subject under 200 characters.');
    if (message.length > 1000) fail('Keep the message under 1000 characters.');

    return {
        name,
        report_kind: 'studio',
        report_config: { sources, columns, brandScope },
        frequency,
        day_of_week: frequency === 'weekly' ? dayOfWeek : 0,
        day_of_month: frequency === 'monthly' ? dayOfMonth : 0,
        send_time: sendTime,
        date_window: dateWindow,
        recipients,
        subject,
        message,
        format: 'csv',
    };
};

/** If today's send time has already gone, the first delivery is the next one rather than right now. */
const skipPassedSlot = (schedule) =>
    schedule.last_period !== istNow().date && slotPassedToday(schedule)
        ? { ...schedule, last_period: istNow().date, last_status: '', attempts: 0 }
        : schedule;

export const createSchedule = async ({ user, dbId, body }) => {
    const input = parseInput(body);
    await ensureReportScheduleTable();
    const schedule = skipPassedSlot({
        id: crypto.randomUUID(),
        db_id: dbId,
        created_by: String(user.email || '').toLowerCase(),
        created_by_id: String(user.userId || ''),
        created_by_name: String(user.userName || ''),
        created_at: istNow().dateTime,
        ...input,
        status: 'active',
        last_period: '',
        last_status: '',
        last_sent_at: '',
        last_error: '',
        attempts: 0,
    });
    return save(schedule);
};

export const updateSchedule = (existing, body) => save(skipPassedSlot({ ...existing, ...parseInput(body) }));

export const setScheduleStatus = (existing, status) =>
    save(status === 'active' ? skipPassedSlot({ ...existing, status }) : { ...existing, status });

/** Marks today's delivery as started, so no other run picks it up. */
export const claimDelivery = (schedule, now = new Date()) => {
    const { date } = istNow(now);
    return save({
        ...schedule,
        last_period: date,
        last_status: 'sending',
        last_error: '',
        attempts: schedule.last_period === date ? schedule.attempts + 1 : 1,
    });
};

/** Records how a delivery ended: 'sent', 'partial' (some recipients failed) or 'failed'. */
export const recordDelivery = (schedule, { status, error = '' }) =>
    save({
        ...schedule,
        last_status: status,
        last_error: String(error).slice(0, 1000),
        last_sent_at: status === 'failed' ? schedule.last_sent_at : istNow().dateTime,
    });

/** Drops one recipient (unsubscribe); a schedule left with none is paused. */
export const removeRecipient = (schedule, email) => {
    const recipients = schedule.recipients.filter((r) => r !== email.toLowerCase());
    return save({ ...schedule, recipients, status: recipients.length ? schedule.status : 'paused' });
};
