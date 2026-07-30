// src/utils/whatsappTemplate.js
// Builds WhatsApp Cloud API template components for the digital_insight_alert template

/**
 * Sanitize a text segment for WhatsApp template parameters.
 * Removes newlines and trims whitespace.
 */
const sanitizeSegment = (text) => {
    if (!text) return '';
    return String(text).replace(/[\r\n]+/g, ' ').trim();
};

/**
 * Build a formatted report block from an array of alert line items.
 * Each line is an object like { emoji: '🔴', label: 'Out of Budget', detail: 'Total: 24' }
 * If lines is a simple string, return it as-is.
 */
const buildReportBlock = (lines) => {
    if (!lines) return '';
    if (typeof lines === 'string') return sanitizeSegment(lines);
    if (Array.isArray(lines)) {
        return lines
            .map(l => {
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

/**
 * Build WhatsApp Cloud API template components array for the digital_insight_alert template.
 * 
 * Template body: "Hello {{1}}, We've identified the following alerts for *{{2}}*: {{3}} ..."
 * Template button: URL button "Open Dashboard" -> https://trailytics.in/{{1}}
 * 
 * @param {Object} params
 * @param {string} params.recipientName - Variable 1: Recipient name
 * @param {string} params.clientName - Variable 2: Client/Brand name
 * @param {string|Array} params.lines - Variable 3: Alert details (string or array of line items)
 * @param {string} [params.dashboardPathParam] - Dynamic URL suffix for the dashboard button
 * @returns {Array} components - WhatsApp template components array
 */
export const buildAlertTemplateComponents = ({
    recipientName = 'there',
    clientName = 'your account',
    lines = '',
    dashboardPathParam = ''
} = {}) => {
    const components = [
        {
            type: 'body',
            parameters: [
                { type: 'text', parameter_name: '1', text: sanitizeSegment(recipientName) || 'there' },
                { type: 'text', parameter_name: '2', text: sanitizeSegment(clientName) || 'your account' },
                { type: 'text', parameter_name: '3', text: buildReportBlock(lines) },
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
 * Build the full text representation (for logging / fallback)
 */
export const buildAlertFullText = ({ recipientName, clientName, lines }) => {
    const name = sanitizeSegment(recipientName) || 'there';
    const client = sanitizeSegment(clientName) || 'your account';
    const body = buildReportBlock(lines);
    return `Hello ${name},\nWe've identified the following alerts for ${client}:\n${body}\nKindly review the dashboard and take the necessary action.\nRegards,\nTrailytics Team`;
};
