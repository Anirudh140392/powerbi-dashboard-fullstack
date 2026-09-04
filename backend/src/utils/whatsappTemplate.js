// src/utils/whatsappTemplate.js
// Builds WhatsApp Cloud API template components for the digital_insight_alert template.
//
// ─── Line-break mechanism inside {{3}} ───────────────────────────────────────
// Production testing has confirmed that the carriage-return character \r (0x0D)
// renders as an actual line break on WhatsApp clients when used inside a
// template body parameter value.  All dynamic line breaks in
// buildAlertBodyParam() therefore use \r exclusively via the LS constant.
//
// \n (0x0A, LF) is NOT used inside the API parameter value — sanitizeSegment()
// strips it from any data values that might accidentally carry it, but does NOT
// strip \r so that intentional LS line-breaks are preserved end-to-end.
//
// The static Meta WhatsApp template body text is NOT changed.
// Only the application-side construction of {{3}} is modified here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line-separator character used for all dynamic line breaks inside the
 * {{3}} WhatsApp template parameter.
 * Production-confirmed to render as a newline on WhatsApp clients.
 */
const LS = '\r';

/**
 * Sanitize a plain-text value before embedding it inside a {{3}} segment.
 *
 * Strips \n (LF) and \t from data values — these can cause API validation
 * issues.  Deliberately preserves \r (CR = LS) so that intentional line-break
 * characters placed by buildAlertBodyParam() survive to the API unchanged.
 * Also collapses runs of >4 consecutive spaces.
 *
 * @param {string} text
 * @returns {string}
 */
const sanitizeSegment = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/[\n\t]+/g, ' ')    // strip LF and tab — preserve CR (\r = LS)
        .replace(/ {5,}/g, '    ')   // collapse >4 consecutive spaces to 4
        .trim();
};

// ─── Structured alert body builders ──────────────────────────────────────────

/**
 * @typedef {Object} AlertEntry
 * @property {string}   title       - Alert title / name
 * @property {string}   [platform]  - Platform name (omitted when absent)
 * @property {string}   [threshold] - Threshold description, e.g. "Below 80%"
 * @property {string}   [overallOsa] - Overall platform OSA for the latest date, e.g. "82.4%"
 * @property {string[]} skus        - Impacted SKU names (all shown)
 */

/**
 * Build the value for the {{3}} template parameter from one or more
 * AlertEntry objects.
 *
 * Uses \r (LS) as the line-break character — production-confirmed to render
 * as an actual newline on WhatsApp clients.
 *
 * Output format for each alert:
 *
 *   Title: <title>\r
 *   Platform: <platform>\r     ← omitted entirely when platform is absent
 *   Threshold: <threshold>\r   ← omitted entirely when threshold is absent
 *   \r                         ← blank line separating header from SKU list
 *   <N> Impacted SKU[s]:\r
 *   • <SKU 1>\r
 *   • <SKU 2>
 *
 * Multiple alerts are separated by \r\r (one visible blank line between them).
 *
 * Rules:
 *  - "1 Impacted SKU:" (singular) vs "N Impacted SKUs:" (plural)
 *  - Zero SKUs → "No impacted SKUs." instead of "0 Impacted SKUs:"
 *  - Platform / Threshold lines are omitted entirely when data is absent
 *  - No fake/default values are invented for missing fields
 *  - All data values pass through sanitizeSegment() before embedding
 *
 * @param {AlertEntry[]} alerts
 * @returns {string}  \r-separated string for the {{3}} API parameter
 */
export const buildAlertBodyParam = (alerts) => {
    if (!Array.isArray(alerts) || alerts.length === 0) {
        return 'No alert details available.';
    }

    const alertBlocks = alerts.map((entry) => {
        const lines = [];

        // Title — always shown
        const title = sanitizeSegment(entry.title);
        if (title) lines.push(`Title: ${title}`);

        // Platform — only when data is present
        const platform = sanitizeSegment(entry.platform);
        if (platform) lines.push(`Platform: ${platform}`);

        // Threshold — only when data is present
        const threshold = sanitizeSegment(entry.threshold);
        if (threshold) lines.push(`Threshold: ${threshold}`);

        // Overall Metric — only when data is present
        const overallOsa = sanitizeSegment(entry.overallOsa);
        if (overallOsa) {
            const overallLabel = sanitizeSegment(entry.overallLabel) || 'Overall OSA';
            lines.push(`${overallLabel}: ${overallOsa}`);
        }

        // Blank line between the header block and the SKU section
        lines.push('');

        // SKU list
        const skuList = Array.isArray(entry.skus) ? entry.skus.filter(Boolean) : [];
        const itemName = entry.impactedItemName || 'SKU';
        const itemNamePlural = itemName === 'City' ? 'Cities' : itemName + 's';
        if (skuList.length === 0) {
            lines.push(`No impacted ${itemNamePlural}.`);
        } else {
            const count = skuList.length;
            const label = count === 1 ? `1 Impacted ${itemName}:` : `${count} Impacted ${itemNamePlural}:`;
            lines.push(label);
            // Each item on its own line, prefixed with bullet
            skuList.forEach((s) => lines.push(`\u2022 ${sanitizeSegment(String(s))}`) );
        }

        // Join lines within one alert block using \r
        return lines.join(LS);
    });

    // Separate multiple alerts with one blank line (\r\r)
    return alertBlocks.join(LS + LS);
};

/**
 * Build a human-readable multi-line version of the same alert data for use
 * in server logs and email/fallback text.
 *
 * Uses real newline characters — do NOT pass this to the WhatsApp template
 * API parameter directly.
 *
 * @param {AlertEntry[]} alerts
 * @returns {string}
 */
export const buildAlertBodyText = (alerts) => {
    if (!Array.isArray(alerts) || alerts.length === 0) {
        return 'No alert details available.';
    }

    return alerts.map((entry) => {
        const lines = [];

        const title = (entry.title || '').trim();
        if (title) lines.push(`Title: ${title}`);

        const platform = (entry.platform || '').trim();
        if (platform) lines.push(`Platform: ${platform}`);

        const threshold = (entry.threshold || '').trim();
        if (threshold) lines.push(`Threshold: ${threshold}`);

        const overallOsa = (entry.overallOsa || '').trim();
        if (overallOsa) {
            const overallLabel = (entry.overallLabel || 'Overall OSA').trim();
            lines.push(`${overallLabel}: ${overallOsa}`);
        }

        lines.push(''); // blank line before SKU count

        const skuList = Array.isArray(entry.skus) ? entry.skus.filter(Boolean) : [];
        const itemName = entry.impactedItemName || 'SKU';
        const itemNamePlural = itemName === 'City' ? 'Cities' : itemName + 's';
        
        if (skuList.length === 0) {
            lines.push(`No impacted ${itemNamePlural}.`);
        } else {
            const count = skuList.length;
            const label = count === 1 ? `1 Impacted ${itemName}:` : `${count} Impacted ${itemNamePlural}:`;
            lines.push(label);
            skuList.forEach((s) => lines.push(String(s).trim()));
        }

        return lines.join('\n');
    }).join('\n\n'); // blank line between alerts
};

// ─── Legacy helper (kept for backward compatibility) ──────────────────────────

/**
 * @deprecated  Prefer buildAlertBodyParam() for {{3}} API parameters and
 *              buildAlertBodyText() for logging / fallback.
 *
 * Build a formatted report block from an array of alert line items.
 * Each line is an object like { emoji: '🔴', label: 'Out of Budget', detail: 'Total: 24' }
 * If lines is a simple string, return it as-is (sanitized).
 */
const buildReportBlock = (lines) => {
    if (!lines) return '';
    if (typeof lines === 'string') return sanitizeSegment(lines);
    if (Array.isArray(lines)) {
        return lines
            .map((l) => {
                if (typeof l === 'string') return sanitizeSegment(l);
                const emoji = l.emoji || '';
                const label = l.label || '';
                const detail = l.detail ? ` • ${l.detail}` : '';
                return sanitizeSegment(`${emoji} ${label}${detail}`);
            })
            .join('  ');
    }
    return String(lines);
};

// ─── Template component builders ─────────────────────────────────────────────

/**
 * Build WhatsApp Cloud API template components array for the
 * digital_insight_alert template.
 *
 * Template body:
 *   "Hello {{1}},\nWe've identified the following alerts for *{{2}}*:\n{{3}}\nKindly review…"
 * Template button:
 *   URL button "Open Dashboard" → https://trailytics.in/{{1}}
 *
 * ── Accepted call signatures ──────────────────────────────────────────────────
 * New (preferred) — structured alerts:
 *   buildAlertTemplateComponents({ recipientName, clientName, alerts: AlertEntry[], dashboardPathParam })
 *
 * Legacy (backward-compatible) — raw lines string/array:
 *   buildAlertTemplateComponents({ recipientName, clientName, lines, dashboardPathParam })
 *
 * @param {Object}        params
 * @param {string}        params.recipientName       - {{1}} recipient name
 * @param {string}        params.clientName          - {{2}} client / brand name
 * @param {AlertEntry[]}  [params.alerts]            - {{3}} structured data (preferred)
 * @param {string|Array}  [params.lines]             - {{3}} raw string/array (legacy)
 * @param {string}        [params.dashboardPathParam] - dynamic URL suffix for button
 * @returns {Array} WhatsApp template components array
 */
export const buildAlertTemplateComponents = ({
    recipientName = 'there',
    clientName = 'your account',
    alerts = null,
    lines = '',
    dashboardPathParam = '',
} = {}) => {
    let bodyParam;
    if (alerts && Array.isArray(alerts) && alerts.length > 0) {
        bodyParam = buildAlertBodyParam(alerts);
    } else {
        bodyParam = buildReportBlock(lines);
    }

    const components = [
        {
            type: 'body',
            parameters: [
                { type: 'text', parameter_name: '1', text: sanitizeSegment(recipientName) || 'there' },
                { type: 'text', parameter_name: '2', text: sanitizeSegment(clientName) || 'your account' },
                { type: 'text', parameter_name: '3', text: bodyParam },
            ],
        },
    ];

    if (dashboardPathParam) {
        components.push({
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: sanitizeSegment(dashboardPathParam) }],
        });
    }

    return components;
};

/**
 * Build the full-text representation (for logging / fallback / non-template
 * messages).  Uses real newlines — do NOT pass this to the template API.
 *
 * Mirrors the two call signatures of buildAlertTemplateComponents().
 *
 * @param {Object}       params
 * @param {string}       params.recipientName
 * @param {string}       params.clientName
 * @param {AlertEntry[]} [params.alerts]
 * @param {string|Array} [params.lines]
 * @returns {string}
 */
export const buildAlertFullText = ({ recipientName, clientName, alerts = null, lines }) => {
    const name = sanitizeSegment(recipientName) || 'there';
    const client = sanitizeSegment(clientName) || 'your account';

    let body;
    if (alerts && Array.isArray(alerts) && alerts.length > 0) {
        body = buildAlertBodyText(alerts);
    } else {
        body = buildReportBlock(lines);
    }

    return [
        `Hello ${name},`,
        `We've identified the following alerts for ${client}:`,
        '',
        body,
        '',
        'Kindly review the dashboard and take the necessary action.',
        'Regards,',
        'Trailytics Team',
    ].join('\n');
};
