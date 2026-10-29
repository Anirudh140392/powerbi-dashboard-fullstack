// src/utils/scheduledReportEmailTemplate.js
// Email for a scheduled report delivery, in the same light layout as the
// Intelligent Alert email (dynamic_alert.html).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.join(__dirname, '..', 'scheduled_report.html');

const escapeHtml = (str) => {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const month = months[parseInt(parts[1], 10) - 1] || '';
    return `${day} ${month} ${parts[0]}`;
};

const periodText = (start, end) =>
    start === end ? formatDateDisplay(start) : `${formatDateDisplay(start)} – ${formatDateDisplay(end)}`;

const spacer = (height) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:${height}px;line-height:${height}px;font-size:${height}px;">&nbsp;</td></tr>
</table>`;

const buildLogo = (logoUrl, companyName) => {
    if (!logoUrl) {
        return `<div style="padding:4px 0;font-family:Arial,sans-serif;color:#111827;font-size:16px;
            line-height:20px;font-weight:800;">${escapeHtml(companyName)}</div>`;
    }
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding:4px 0;">
    <img src="${escapeHtml(logoUrl)}"
         alt="${escapeHtml(companyName)} Logo"
         width="110"
         class="logo"
         style="width:110px;max-width:110px;height:auto;display:block;
                border:0;outline:none;text-decoration:none;">
</td>
</tr>
</table>`;
};

/** One summary tile: { label, value, note, delta, deltaGood }. */
const buildTile = (tile, index, count) => {
    const width = `${(100 / count).toFixed(2)}%`;
    const padding = index === 0 ? '0 6px 0 0' : index === count - 1 ? '0 0 0 6px' : '0 3px';
    const deltaHtml = tile.delta
        ? `<span style="color:${tile.deltaGood ? '#16a34a' : '#dc2626'};font-weight:700;">${escapeHtml(tile.delta)}</span> `
        : '';
    return `
<td class="metric-cell" width="${width}" valign="top" style="width:${width};padding:${padding};">
<table bgcolor="#ffffff" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#ffffff;border:1px solid #dde8fb;">
<tr>
<td class="metric-box" style="padding:8px;">
<div style="font-family:Arial,sans-serif;font-size:8px;line-height:10px;
            text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:.3px;">
    ${escapeHtml(tile.label)}
</div>
<div class="metric-value"
     style="font-family:Arial,sans-serif;font-size:15px;line-height:18px;
            font-weight:800;color:#111827;padding-top:3px;
            word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(tile.value)}
</div>
<div style="font-family:Arial,sans-serif;font-size:8px;line-height:11px;
            color:#64748b;padding-top:4px;word-break:break-word;
            word-wrap:break-word;overflow-wrap:break-word;">
    ${deltaHtml}${escapeHtml(tile.note || '')}
</div>
</td>
</tr>
</table>
</td>`;
};

/** First rows of the report, in the alert email's "Impacted Items" table style. */
const buildPreview = ({ headers = [], rows = [], totalRows = 0, totalColumns = 0 }) => {
    if (!headers.length || !rows.length) return '';
    const colWidth = `${Math.floor(100 / headers.length)}%`;
    const title = (totalRows > rows.length
        ? `Preview · first ${rows.length} of ${totalRows.toLocaleString('en-IN')} rows`
        : `Preview · ${rows.length} rows`)
        + (totalColumns > headers.length ? ` · ${headers.length} of ${totalColumns} columns` : '');

    const headerCells = headers.map((h, i) => `
<td bgcolor="#f8fbff" width="${colWidth}"
    style="width:${colWidth};padding:5px 6px;background-color:#f8fbff;
           border-right:${i < headers.length - 1 ? '1px solid #e3ebf8' : 'none'};border-bottom:2px solid #d7e6ff;
           font-family:Arial,sans-serif;color:#475569;font-size:7px;
           line-height:9px;font-weight:700;text-transform:uppercase;
           word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(h)}
</td>`).join('');

    const bodyRows = rows.map((row, r) => `<tr>${row.map((value, i) => `
<td style="padding:5px 6px;border-right:${i < row.length - 1 ? '1px solid #e3ebf8' : 'none'};
           border-bottom:${r < rows.length - 1 ? '1px solid #f3f4f6' : 'none'};
           font-family:Arial,sans-serif;color:#111827;font-size:9px;
           line-height:12px;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(value)}
</td>`).join('')}</tr>`).join('');

    return `${spacer(10)}
<table bgcolor="#ffffff" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="width:100%;background-color:#ffffff;border:1px solid #e5eaf3;">
<tr>
<td bgcolor="#f8fafc" class="section-title"
    style="padding:5px 8px;background-color:#f8fafc;border-bottom:1px solid #e8eef7;
           font-family:Arial,sans-serif;color:#64748b;font-size:8px;
           line-height:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;">
    ${escapeHtml(title)}
</td>
</tr>
<tr>
<td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tbl"
       style="width:100%;table-layout:fixed;">
<tr>${headerCells}</tr>
${bodyRows}
</table>
</td>
</tr>
</table>`;
};

/** Attachment line, or a download button when the file is sent as a link. */
const buildDelivery = ({ attachment, downloadUrl, linkExpiresOn }) => {
    if (downloadUrl) {
        return `The report is too large to attach. Download it here:
${spacer(6)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td bgcolor="#1e5eff" style="background-color:#1e5eff;padding:7px 16px;">
    <a href="${escapeHtml(downloadUrl)}" target="_blank"
       style="font-family:Arial,sans-serif;color:#ffffff;font-size:10px;line-height:12px;
              font-weight:700;text-decoration:none;display:block;">
        Download report
    </a>
</td>
</tr>
</table>
${linkExpiresOn ? `<div style="font-family:Arial,sans-serif;color:#64748b;font-size:8px;line-height:11px;padding-top:4px;">
    Link expires on ${escapeHtml(formatDateDisplay(linkExpiresOn))}.
</div>` : ''}`;
    }
    if (attachment) {
        return `Attached: <b>${escapeHtml(attachment.fileName)}</b>${attachment.size ? ` (${escapeHtml(attachment.size)})` : ''}`;
    }
    return 'No data for this period, so no file is attached.';
};

const buildDetails = (details) => details.map(({ label, value }, i) => `
<tr>
<td width="32%" valign="top"
    style="width:32%;padding:4px 0;${i < details.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}
           font-family:Arial,sans-serif;color:#64748b;font-size:9px;line-height:12px;font-weight:700;">
    ${escapeHtml(label)}
</td>
<td valign="top"
    style="padding:4px 0;${i < details.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}
           font-family:Arial,sans-serif;color:#111827;font-size:9px;line-height:12px;
           word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(value)}
</td>
</tr>`).join('');

const buildMessage = (message) => (message
    ? `${spacer(6)}
<div style="font-family:Arial,sans-serif;color:#475569;font-size:10px;line-height:14px;
            word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(message).replace(/\n/g, '<br>')}
</div>`
    : '');

const buildFooterLinks = (unsubscribeUrl, manageUrl) => {
    const links = [
        manageUrl && `<a href="${escapeHtml(manageUrl)}" style="color:#4b74c9;text-decoration:underline;">Manage schedule</a>`,
        unsubscribeUrl && `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#4b74c9;text-decoration:underline;">Unsubscribe</a>`,
    ].filter(Boolean);
    if (!links.length) return '';
    return `<tr>
<td align="center" style="padding-top:3px;font-family:Arial,sans-serif;color:#64748b;font-size:8px;line-height:11px;">
    ${links.join(' &middot; ')}
</td>
</tr>`;
};

/**
 * @param {object} data
 * @param {string} data.reportName        e.g. "Weekly Availability Report"
 * @param {string} data.frequency         "Daily" | "Weekly" | "Monthly"
 * @param {string} data.periodStart       YYYY-MM-DD of the first day the report covers
 * @param {string} data.periodEnd         YYYY-MM-DD of the last day
 * @param {Array}  data.summaryTiles      up to 3–4 of { label, value, note, delta, deltaGood }
 * @param {object} data.preview           { headers, rows, totalRows, totalColumns }; rows are display strings
 * @param {object} data.attachment        { fileName, size } when the file is attached
 * @param {string} data.downloadUrl       signed link when the file is too large to attach
 * @param {Array}  data.details           [{ label, value }] — sources, filters, brands, format
 */
export const generateScheduledReportEmailHtml = (data) => {
    const {
        logoUrl = '',
        companyName = 'Company',
        istNow = '',
        reportName = 'Scheduled Report',
        frequency = 'Daily',
        periodStart = '',
        periodEnd = '',
        message = '',
        summaryTiles = [],
        preview = {},
        attachment = null,
        downloadUrl = '',
        linkExpiresOn = '',
        details = [],
        scheduledBy = '',
        unsubscribeUrl = '',
        manageUrl = '',
    } = data;

    const period = periodStart && periodEnd ? periodText(periodStart, periodEnd) : '';
    const periodLabel = period ? `${escapeHtml(frequency)} report &middot; Data for ${escapeHtml(period)}` : '';
    const tiles = summaryTiles.slice(0, 4);

    const values = {
        COMPANY_NAME: escapeHtml(companyName),
        REPORT_NAME: escapeHtml(reportName),
        FREQUENCY: escapeHtml(frequency),
        TIMESTAMP: escapeHtml(istNow),
        PERIOD_LABEL: periodLabel,
        PREHEADER: escapeHtml(`${reportName}${period ? ` · ${period}` : ''}`),
        LOGO_HTML: buildLogo(logoUrl, companyName),
        MESSAGE_HTML: buildMessage(message),
        SUMMARY_TILES_HTML: tiles.map((t, i) => buildTile(t, i, tiles.length)).join(''),
        PREVIEW_HTML: buildPreview(preview),
        DELIVERY_HTML: buildDelivery({ attachment, downloadUrl, linkExpiresOn }),
        DETAILS_HTML: buildDetails(details),
        SCHEDULED_BY_HTML: scheduledBy ? ` &middot; Scheduled by ${escapeHtml(scheduledBy)}` : '',
        FOOTER_LINKS_HTML: buildFooterLinks(unsubscribeUrl, manageUrl),
    };

    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => (key in values ? values[key] : match));
};
