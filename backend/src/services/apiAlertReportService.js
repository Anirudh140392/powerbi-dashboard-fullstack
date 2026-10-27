/**
 * Automated Daily API Alert Email Reporter Service (Pure JavaScript / Node.js)
 * Trailytics API Monitoring System
 * 
 * - Queries ClickHouse `admin_master.api_logs` for failed or empty response endpoints.
 * - Queries `admin_master.api_alert` for active recipient emails.
 * - Fills `api_alert_email.html` with tabular issue details.
 * - Dispatches email via Microsoft Office 365 SMTP using Nodemailer.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dayjs from 'dayjs';
import { queryAdminDB } from '../config/adminClickhouse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate template in api_alert_reporter directory or fallback to local
const TEMPLATE_CANDIDATES = [
    path.resolve(__dirname, '../../../api_alert_reporter/api_alert_email.html'),
    path.resolve(__dirname, '../../templates/api_alert_email.html'),
];

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Fetch active, valid recipient emails from admin_master.api_alert
 */
export async function fetchAlertRecipients() {
    try {
        console.log('[ApiAlertReport] Querying recipients from admin_master.api_alert...');
        const rows = await queryAdminDB('SELECT * FROM admin_master.api_alert');
        
        const validRecipients = [];
        const seen = new Set();
        let skipped = 0;

        for (const row of rows) {
            let isActive = true;
            for (const key of ['is_active', 'active', 'status']) {
                if (row[key] !== undefined && row[key] !== null) {
                    const val = String(row[key]).trim().toLowerCase();
                    if (['0', 'false', 'inactive', 'disabled'].includes(val)) {
                        isActive = false;
                    }
                    break;
                }
            }
            if (!isActive) {
                skipped++;
                continue;
            }

            let emailVal = null;
            for (const key of ['email', 'email_id', 'recipient', 'mail']) {
                if (row[key]) {
                    emailVal = String(row[key]).trim().toLowerCase();
                    break;
                }
            }

            if (!emailVal || !EMAIL_REGEX.test(emailVal)) {
                skipped++;
                continue;
            }

            if (!seen.has(emailVal)) {
                seen.add(emailVal);
                validRecipients.push(emailVal);
            }
        }

        console.log(`[ApiAlertReport] Validated ${validRecipients.length} unique recipient(s) (skipped ${skipped}).`);
        return validRecipients;
    } catch (err) {
        console.error('[ApiAlertReport] Failed to fetch recipients from admin_master.api_alert:', err.message);
        throw err;
    }
}

/**
 * Fetch API issues (failed or empty response) from admin_master.api_logs
 */
export async function fetchApiIssues(dateScope = 'latest') {
    try {
        let targetDate = dayjs().format('YYYY-MM-DD');

        if (dateScope === 'latest') {
            const probeRes = await queryAdminDB('SELECT max(toDate(Date)) as latest_d FROM admin_master.api_logs');
            if (probeRes && probeRes[0]?.latest_d) {
                targetDate = dayjs(probeRes[0].latest_d).format('YYYY-MM-DD');
            }
        }

        console.log(`[ApiAlertReport] Fetching API issues for target date: ${targetDate}...`);

        const query = `
            SELECT 
                Date,
                Page,
                client_db,
                segment,
                api,
                status_code,
                response_status,
                empty_response,
                error_message
            FROM admin_master.api_logs
            WHERE toDate(Date) = '${targetDate}'
              AND (
                (response_status = 'Failed' OR status_code >= 400 OR status_code = 0)
                OR (empty_response = 1)
              )
            ORDER BY Date DESC, Page ASC, client_db ASC
        `;

        const issues = await queryAdminDB(query);
        console.log(`[ApiAlertReport] Found ${issues.length} API issue(s) matching criteria for ${targetDate}.`);
        return { issues, targetDate };
    } catch (err) {
        console.error('[ApiAlertReport] Failed to query API issues:', err.message);
        throw err;
    }
}

/**
 * Build HTML report content by populating template
 */
export function buildReportHtml(issues, targetDate) {
    let templatePath = null;
    for (const cand of TEMPLATE_CANDIDATES) {
        if (fs.existsSync(cand)) {
            templatePath = cand;
            break;
        }
    }

    if (!templatePath) {
        throw new Error(`[ApiAlertReport] Template api_alert_email.html not found in expected paths.`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const dtObj = dayjs(targetDate);
    const reportDateFormatted = dtObj.format('DD MMM YYYY');
    const reportYear = dtObj.format('YYYY');

    const generatedRows = issues.map((row, idx) => {
        const rowNum = idx + 1;
        const bgColor = rowNum % 2 !== 0 ? '#ffffff' : '#f9fafb';

        const rawDate = row.Date ? String(row.Date).substring(0, 10) : targetDate;
        const page = escapeHtml(row.Page || 'N/A');
        const clientDb = escapeHtml(row.client_db || 'N/A');
        const segment = escapeHtml(row.segment || 'N/A');
        const apiEndpoint = escapeHtml(row.api || 'N/A');

        const statusNum = Number(row.status_code) || 0;
        const isEmpty = Number(row.empty_response) === 1;
        const respStatus = String(row.response_status || '').toLowerCase().trim();
        const errMsg = String(row.error_message || '').toLowerCase().trim();

        // Response reason badge
        let responseBadgeHtml = '';
        if (errMsg.includes('timeout') || errMsg.includes('timed out') || statusNum === 408 || statusNum === 504) {
            responseBadgeHtml = '<span style="display:inline-block; padding:3px 10px; border-radius:12px; background-color:#ffedd5; color:#c2410c; font-weight:600; font-size:12px;">Timeout</span>';
        } else if (statusNum >= 400 || (statusNum === 0 && respStatus === 'failed') || respStatus === 'failed') {
            responseBadgeHtml = '<span style="display:inline-block; padding:3px 10px; border-radius:12px; background-color:#fee2e2; color:#991b1b; font-weight:600; font-size:12px;">Failed</span>';
        } else if (isEmpty) {
            responseBadgeHtml = '<span style="display:inline-block; padding:3px 10px; border-radius:12px; background-color:#fef3c7; color:#92400e; font-weight:600; font-size:12px;">Empty</span>';
        } else {
            responseBadgeHtml = '<span style="display:inline-block; padding:3px 10px; border-radius:12px; background-color:#fee2e2; color:#991b1b; font-weight:600; font-size:12px;">Failed</span>';
        }

        // Status code badge
        let statusBadgeHtml = '';
        if (statusNum === 200) {
            statusBadgeHtml = '<span style="display:inline-block; padding:3px 10px; border-radius:12px; background-color:#fef3c7; color:#92400e; font-weight:600; font-size:12px;">200</span>';
        } else {
            const codeText = statusNum !== 0 ? String(row.status_code) : '0';
            statusBadgeHtml = `<span style="display:inline-block; padding:3px 10px; border-radius:12px; background-color:#fee2e2; color:#991b1b; font-weight:600; font-size:12px;">${escapeHtml(codeText)}</span>`;
        }

        return `                  <tr style="background-color:${bgColor};">
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827;">${rowNum}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827; white-space:nowrap;">${escapeHtml(rawDate)}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827;">${page}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827;">${clientDb}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827;">${segment}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#b91c1c; word-break:break-all;">${apiEndpoint}</td>
                    <td align="center" style="padding:10px 12px; border:1px solid #e5e7eb;">${statusBadgeHtml}</td>
                    <td align="center" style="padding:10px 12px; border:1px solid #e5e7eb;">${responseBadgeHtml}</td>
                  </tr>`;
    });

    const allRowsStr = generatedRows.join('\n');

    const rowBlockPattern = /<!-- ===== ROW TEMPLATE:[\s\S]*?<!-- ===== END ROW TEMPLATE ===== -->/;
    let renderedHtml = '';
    if (rowBlockPattern.test(templateContent)) {
        renderedHtml = templateContent.replace(rowBlockPattern, allRowsStr);
    } else {
        renderedHtml = templateContent.replace('<tbody>', `<tbody>\n${allRowsStr}`);
    }

    renderedHtml = renderedHtml
        .replace(/\{\{REPORT_DATE\}\}/g, reportDateFormatted)
        .replace(/\{\{TOTAL_COUNT\}\}/g, String(issues.length))
        .replace(/\{\{YEAR\}\}/g, reportYear)
        .replace(/Your Company Name/g, 'Trailytics');

    return { renderedHtml, reportDateFormatted, reportYear };
}

/**
 * Send email via Nodemailer (Office 365 SMTP)
 */
export async function sendEmailAlert({ recipients, htmlContent, reportDateFormatted, issueCount }) {
    const senderEmail = (
        process.env.SENDER_EMAIL ||
        process.env.Alert_email ||
        process.env.SMTP_USER ||
        'business@trailytics.com'
    ).trim();

    const senderPass = (
        process.env.SENDER_PASSWORD ||
        process.env.Alert_email_password ||
        process.env.ALERT_EMAIL_PASSWORD ||
        process.env.SMTP_PASS ||
        ''
    ).trim();

    const smtpHost = (process.env.SMTP_HOST || 'smtp.office365.com').trim();
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const senderDisplayName = (process.env.SENDER_DISPLAY_NAME || 'Trailytics API Monitor').trim();

    if (!senderPass) {
        throw new Error('[ApiAlertReport] SENDER_PASSWORD / Alert_email_password is not configured in .env!');
    }

    console.log(`[ApiAlertReport] Initializing SMTP connection to ${smtpHost}:${smtpPort} as ${senderEmail}...`);

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: senderEmail,
            pass: senderPass,
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false,
        },
    });

    const subject = `API Alert Report - ${reportDateFormatted} - ${issueCount} issues found`;
    const plainText = `API Alert Report - ${reportDateFormatted}\nTotal issues found: ${issueCount}\n\nPlease view this email in an HTML-capable email client to view the complete table of failed APIs.`;

    const mailOptions = {
        from: `"${senderDisplayName}" <${senderEmail}>`,
        to: senderEmail,
        bcc: recipients,
        subject,
        text: plainText,
        html: htmlContent,
    };

    console.log(`[ApiAlertReport] Sending email to ${recipients.length} recipient(s)...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[ApiAlertReport] ✅ Email report dispatched successfully! MessageId: ${info.messageId}`);
    return info;
}

/**
 * Main Orchestrator: Runs full report generation and dispatch
 */
export async function sendApiAlertReport(options = {}) {
    console.log('======================================================================');
    console.log(`[ApiAlertReport] Starting automated JS email report cycle at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}...`);
    console.log('======================================================================');

    const recipients = await fetchAlertRecipients();
    if (!recipients || recipients.length === 0) {
        console.warn('[ApiAlertReport] No active recipients found in admin_master.api_alert. Aborting send.');
        return { success: false, reason: 'no_recipients' };
    }

    const { issues, targetDate } = await fetchApiIssues(options.dateScope || 'latest');
    if (issues.length === 0 && !options.sendIfNoIssues) {
        console.log('[ApiAlertReport] No failed or empty response APIs detected. Skipping email dispatch.');
        return { success: true, count: 0, skipped: true };
    }

    const { renderedHtml, reportDateFormatted } = buildReportHtml(issues, targetDate);

    if (options.dryRun) {
        console.log(`[ApiAlertReport] [DRY RUN] Generated report for ${issues.length} issues. Skipping send.`);
        return { success: true, dryRun: true, count: issues.length };
    }

    await sendEmailAlert({
        recipients,
        htmlContent: renderedHtml,
        reportDateFormatted,
        issueCount: issues.length,
    });

    console.log(`[ApiAlertReport] ✅ Report cycle completed successfully for ${issues.length} issues.`);
    return { success: true, count: issues.length, targetDate, recipientsCount: recipients.length };
}
