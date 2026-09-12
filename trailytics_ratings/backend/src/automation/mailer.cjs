// /**
//  * SMTP mailer for automation alerts.
//  *
//  * Single place that owns the nodemailer transport. Configured entirely from
//  * env (Gmail / any SMTP):
//  *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
//  *   ALERT_DEFAULT_RECIPIENTS  (comma-separated fallback recipients)
//  */
// const nodemailer = require('nodemailer');

// let transport = null;

// function isMailerConfigured() {
//     return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
// }

// function getTransport() {
//     if (transport) return transport;
//     if (!isMailerConfigured()) {
//         throw new Error('SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS.');
//     }
//     const port = parseInt(process.env.SMTP_PORT || '587', 10);
//     const host = process.env.SMTP_HOST || '';
//     // Office 365 / Outlook on 587 needs STARTTLS opportunistically AND a
//     // TLS minVersion of 1.2 — older Node defaults to 1.0 which O365 rejects.
//     const isOffice365 = /office365|outlook/i.test(host);
//     transport = nodemailer.createTransport({
//         host,
//         port,
//         secure: process.env.SMTP_SECURE === 'true' || port === 465,
//         requireTLS: isOffice365 || port === 587,
//         auth: {
//             user: process.env.SMTP_USER,
//             pass: process.env.SMTP_PASS,
//         },
//         tls: {
//             minVersion: 'TLSv1.2',
//             ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
//         },
//     });
//     return transport;
// }

// function defaultRecipients() {
//     return (process.env.ALERT_DEFAULT_RECIPIENTS || '')
//         .split(',')
//         .map((s) => s.trim())
//         .filter(Boolean);
// }

// /**
//  * Send an alert email.
//  *
//  * Adds a set of standards-compliant but rarely-used headers:
//  *   - List-Unsubscribe + List-Unsubscribe-Post (RFC 8058): Gmail / Apple Mail
//  *     render a native one-click unsubscribe in the message header.
//  *   - X-Priority / Importance: Outlook + Gmail flag the message with a
//  *     red exclamation when {priority:'high'} is passed.
//  *   - In-Reply-To shim: a synthetic Message-ID per rule lets all alerts
//  *     for the same rule thread together in Gmail / Apple Mail.
//  *
//  * @param {object} opts
//  * @param {string[]|string} opts.to   Recipient(s). Falls back to ALERT_DEFAULT_RECIPIENTS.
//  * @param {string} opts.subject
//  * @param {string} opts.html
//  * @param {string} [opts.text]
//  * @param {string} [opts.priority]    'high' | 'normal' (default normal)
//  * @param {string} [opts.threadKey]   Stable key so emails for the same alert rule thread together.
//  * @param {string} [opts.unsubscribeUrl]  Override for the one-click unsubscribe URL.
//  * @param {Array<{filename:string,content:string|Buffer,contentType?:string}>} [opts.attachments]
//  *                                    Optional file attachments (e.g. .ics calendar invite).
//  */
// async function sendAlertEmail({ to, subject, html, text, priority, threadKey, unsubscribeUrl, attachments }) {
//     let recipients = Array.isArray(to) ? to.slice() : (to ? [to] : []);
//     recipients = recipients.map((s) => String(s).trim()).filter(Boolean);
//     if (recipients.length === 0) recipients = defaultRecipients();
//     if (recipients.length === 0) {
//         throw new Error('No recipients for alert email and ALERT_DEFAULT_RECIPIENTS is empty.');
//     }
//     const dashboard = process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';
//     const unsub = unsubscribeUrl || `${dashboard}/settings`;
//     const headers = {
//         'List-Unsubscribe': `<${unsub}>, <mailto:${process.env.SMTP_USER || 'unsubscribe@trailytics.com'}?subject=unsubscribe>`,
//         'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
//         'X-Mailer': 'Trailytics Rating Intelligence',
//         'X-Entity-Ref-ID': threadKey || subject,
//     };
//     if (priority === 'high') {
//         headers['X-Priority'] = '1 (Highest)';
//         headers['X-MSMail-Priority'] = 'High';
//         headers['Importance'] = 'High';
//     }
//     const messageOptions = {
//         from: process.env.SMTP_FROM || process.env.SMTP_USER,
//         to: recipients.join(', '),
//         subject,
//         html,
//         text: text || undefined,
//         headers,
//     };
//     if (Array.isArray(attachments) && attachments.length) {
//         messageOptions.attachments = attachments;
//     }
//     if (threadKey) {
//         // Synthesising a deterministic Message-ID per (recipient, threadKey) groups
//         // related alerts into a single conversation in clients that thread by it.
//         const safeKey = threadKey.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 64);
//         messageOptions.references = `<${safeKey}@ratings.trailytics.com>`;
//     }
//     return getTransport().sendMail(messageOptions);
// }

// module.exports = { sendAlertEmail, isMailerConfigured, defaultRecipients };
