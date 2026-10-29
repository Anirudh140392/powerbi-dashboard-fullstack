// src/services/reportScheduleCronService.js
// Sends due scheduled reports. Every 15 minutes it picks the schedules whose
// send time has passed today (isDue), builds each Report Studio CSV through
// report_backend as the schedule's owner, and emails it with the
// scheduled_report.html template.
import { queryAdminDB } from '../config/adminClickhouse.js';
import { signToken } from './authService.js';
import { sendEmail } from './emailService.js';
import { claimDelivery, listActiveSchedules, recordDelivery } from './reportScheduleService.js';
import { DATE_WINDOWS, isDue, istNow, nextSendAt, resolveDateWindow } from '../utils/reportScheduleTiming.js';
import { generateScheduledReportEmailHtml } from '../utils/scheduledReportEmailTemplate.js';

const INTERVAL_MS = 15 * 60 * 1000;
const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || 'http://localhost:5001';
const APP_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
// Most mail servers reject messages over 20–25 MB, and base64 adds a third.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const PREVIEW_ROWS = 5;
const PREVIEW_COLUMNS = 6;

const SOURCE_LABELS = { pdp: 'Availability & Pricing', kw: 'Share of Search', ms: 'Market Share', pm: 'Performance Marketing' };
const BRAND_LABELS = { own: 'Own brands', all: 'Own + competitors' };
const FREQUENCY_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let cronIntervalId = null;
let running = false;

const formatDate = (date) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

const formatNextSend = (next) => {
    if (!next) return 'Paused';
    const [date, time] = next.split(' ');
    return `${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]}, ${formatDate(date)} at ${time} IST`;
};

const formatBytes = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** CSV text → array of records (handles quoted fields with commas, quotes and line breaks). */
const parseCsv = (text) => {
    const records = [];
    let record = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                field += '"';
                i += 1;
            } else if (ch === '"') quoted = false;
            else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') {
            record.push(field);
            field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i += 1;
            record.push(field);
            records.push(record);
            record = [];
            field = '';
        } else field += ch;
    }
    if (field || record.length) {
        record.push(field);
        records.push(record);
    }
    return records;
};

const getTenant = async (dbId) => {
    const [row] = await queryAdminDB(
        `SELECT db_name, logo_url FROM tb_database WHERE toString(db_id) = {dbId:String} LIMIT 1`,
        { dbId }
    );
    if (!row) throw new Error(`No database found for db_id ${dbId}`);
    return { dbName: row.db_name, logoUrl: row.logo_url || '' };
};

/** The report as CSV text, built by report_backend with a short-lived token for the schedule's owner. */
const fetchStudioCsv = async (schedule, tenant, { startDate, endDate }, today) => {
    const { sources, columns, brandScope } = schedule.report_config;
    const token = signToken(
        {
            userId: schedule.created_by_id,
            email: schedule.created_by,
            userName: schedule.created_by_name,
            dbName: tenant.dbName,
            dbId: schedule.db_id,
            role: '',
            qcUser: 0,
            scheduledReport: schedule.id,
        },
        { expiresIn: '15m' }
    );
    const query = new URLSearchParams({ sources: sources.join(','), columns: columns.join(','), brandScope, startDate, endDate });
    const response = await fetch(`${REPORT_SERVICE_URL}/api/reports/studio/export?${query}`, {
        headers: { Authorization: `Bearer ${token}`, 'x-current-date': today },
        signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    if (response.status === 204) return '';
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Report service returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    return (await response.text()).replace(/^﻿/, '');
};

/** Inline logo: a data: URI logo travels as a cid attachment, since most mail apps block data: images. */
const logoParts = (logoUrl) => {
    if (!logoUrl.startsWith('data:')) return { logoUrl, attachments: [] };
    return { logoUrl: 'cid:company-logo', attachments: [{ filename: 'logo', path: logoUrl, cid: 'company-logo' }] };
};

/**
 * Builds and emails one schedule's report. Recipients each get their own copy,
 * so the unsubscribe link is personal.
 * @returns {Promise<{ status: 'sent'|'partial'|'failed', error: string, rows: number }>}
 */
export const deliverSchedule = async (schedule, now = new Date()) => {
    const { date: today, dateTime } = istNow(now);
    const tenant = await getTenant(schedule.db_id);
    const period = resolveDateWindow(schedule.date_window, today);
    const csv = await fetchStudioCsv(schedule, tenant, period, today);

    const [headers = [], ...rows] = csv ? parseCsv(csv).filter((r) => r.length > 1 || r[0]) : [];
    const bytes = Buffer.byteLength(csv, 'utf8');
    if (bytes > MAX_ATTACHMENT_BYTES) {
        throw new Error(`The report is ${formatBytes(bytes)}, over the ${formatBytes(MAX_ATTACHMENT_BYTES)} email limit. Remove columns or shorten the date range.`);
    }

    const { sources, brandScope } = schedule.report_config;
    const frequency = FREQUENCY_LABELS[schedule.frequency];
    const fileName = `${schedule.name.replace(/[^\w-]+/g, '_')}_${period.startDate}_to_${period.endDate}.csv`;
    const days = Math.round((Date.parse(period.endDate) - Date.parse(period.startDate)) / 86400000) + 1;
    const periodText = period.startDate === period.endDate ? formatDate(period.startDate) : `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`;
    const logo = logoParts(tenant.logoUrl);
    const companyName = tenant.dbName.replace(/_/g, ' ').toUpperCase();
    const subject = schedule.subject || `${schedule.name} · ${periodText}`;
    const attachments = rows.length
        ? [{ filename: fileName, content: `﻿${csv}`, contentType: 'text/csv; charset=utf-8' }]
        : [];

    const emailData = {
        logoUrl: logo.logoUrl,
        companyName,
        istNow: dateTime,
        reportName: schedule.name,
        frequency,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        message: schedule.message,
        summaryTiles: [
            { label: 'Period', value: `${days} ${days === 1 ? 'day' : 'days'}`, note: periodText },
            { label: 'Rows', value: rows.length.toLocaleString('en-IN'), note: rows.length ? 'In the attached file' : 'No data for this period' },
            { label: 'File', value: 'CSV', note: rows.length ? formatBytes(bytes) : 'Not attached' },
        ],
        preview: {
            headers: headers.slice(0, PREVIEW_COLUMNS),
            // Blank cells (a KPI with no value) read as in the Report Studio preview.
            rows: rows.slice(0, PREVIEW_ROWS).map((r) => r.slice(0, PREVIEW_COLUMNS).map((v) => (v === '' ? '—' : v))),
            totalRows: rows.length,
            totalColumns: headers.length,
        },
        attachment: rows.length ? { fileName, size: formatBytes(bytes) } : null,
        details: [
            { label: sources.length > 1 ? 'Data sources' : 'Data source', value: sources.map((s) => SOURCE_LABELS[s] || s).join(', ') },
            { label: 'Columns', value: headers.join(', ') },
            { label: 'Brands', value: BRAND_LABELS[brandScope] || BRAND_LABELS.own },
            { label: 'Dates', value: DATE_WINDOWS[schedule.date_window] },
            { label: 'Next delivery', value: formatNextSend(nextSendAt({ ...schedule, last_period: today }, now)) },
        ],
        scheduledBy: schedule.created_by_name || schedule.created_by,
        manageUrl: `${APP_URL}/report-studio?schedules=1`,
    };

    const failed = [];
    for (const recipient of schedule.recipients) {
        const unsubscribeToken = signToken({ purpose: 'report-unsubscribe', sid: schedule.id, email: recipient });
        try {
            await sendEmail({
                to: recipient,
                subject,
                html: generateScheduledReportEmailHtml({
                    ...emailData,
                    unsubscribeUrl: `${APP_URL}/api/report-schedules/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
                }),
                attachments: [...attachments, ...logo.attachments],
            });
        } catch (error) {
            console.error(`[ReportSchedule] "${schedule.name}" to ${recipient} failed:`, error.message);
            failed.push(`${recipient}: ${error.message}`);
        }
    }

    if (failed.length === schedule.recipients.length) return { status: 'failed', error: failed.join('; '), rows: rows.length };
    return { status: failed.length ? 'partial' : 'sent', error: failed.join('; '), rows: rows.length };
};

/** Claims, delivers and records one scheduled run; a failed run is retried by later jobs (see isDue). */
const runSchedule = async (schedule, now) => {
    const claimed = await claimDelivery(schedule, now);
    try {
        const result = await deliverSchedule(claimed, now);
        await recordDelivery(claimed, result);
        console.log(`[ReportSchedule] "${schedule.name}" ${result.status} (${result.rows} rows, ${schedule.recipients.length} recipients)`);
    } catch (error) {
        console.error(`[ReportSchedule] "${schedule.name}" failed:`, error.message);
        await recordDelivery(claimed, { status: 'failed', error: error.message });
    }
};

export const runDueReportSchedules = async (now = new Date()) => {
    if (running) return;
    running = true;
    try {
        const due = (await listActiveSchedules()).filter((s) => isDue(s, now));
        if (due.length) console.log(`[ReportSchedule] ${due.length} scheduled report(s) due`);
        // One at a time, so a burst of 9 AM schedules doesn't flood report_backend or the mail server.
        for (const schedule of due) await runSchedule(schedule, now);
    } catch (error) {
        console.error('[ReportSchedule] Job failed:', error.message);
    } finally {
        running = false;
    }
};

export const initReportScheduleCron = () => {
    if (cronIntervalId) clearInterval(cronIntervalId);
    console.log('[ReportSchedule] Scheduler started (checks every 15 minutes)');
    cronIntervalId = setInterval(() => runDueReportSchedules(), INTERVAL_MS);
};
