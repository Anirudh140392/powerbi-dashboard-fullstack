// /**
//  * Builds an RFC 5545 .ics calendar invite for CRITICAL rating-drop alerts.
//  *
//  * Outlook / Apple Calendar / Google Calendar auto-detect the attachment and
//  * surface a one-click "Add to calendar" affordance in the email itself.
//  *
//  * Scheduling rules:
//  *   - Event time: next 10:00 AM IST (or tomorrow's if already past 10).
//  *   - Duration: 30 minutes.
//  *   - REMINDER 15 minutes before via VALARM.
//  *   - UID is deterministic per (rule, day) so re-sending the digest updates
//  *     the same calendar entry instead of duplicating it.
//  */

// function fmtIcsDate(date) {
//     // YYYYMMDDTHHmmssZ in UTC
//     const pad = n => String(n).padStart(2, '0');
//     return (
//         date.getUTCFullYear().toString() +
//         pad(date.getUTCMonth() + 1) +
//         pad(date.getUTCDate()) +
//         'T' +
//         pad(date.getUTCHours()) +
//         pad(date.getUTCMinutes()) +
//         pad(date.getUTCSeconds()) +
//         'Z'
//     );
// }

// function nextTenAmIst() {
//     // 10:00 IST == 04:30 UTC. Kept as a fallback only — callers should pass
//     // a resolved Date via opts.scheduledAt.
//     const now = new Date();
//     const target = new Date(now);
//     target.setUTCHours(4, 30, 0, 0);
//     if (now.getTime() >= target.getTime()) {
//         target.setUTCDate(target.getUTCDate() + 1);
//     }
//     return target;
// }

// function fold(line) {
//     // RFC 5545 line-folding: lines >75 octets continue on the next line
//     // beginning with a single space.
//     if (line.length <= 75) return line;
//     const chunks = [];
//     let i = 0;
//     chunks.push(line.slice(i, i + 75));
//     i += 75;
//     while (i < line.length) {
//         chunks.push(' ' + line.slice(i, i + 74));
//         i += 74;
//     }
//     return chunks.join('\r\n');
// }

// function escapeIcsText(s) {
//     if (!s) return '';
//     return String(s)
//         .replace(/\\/g, '\\\\')
//         .replace(/;/g, '\\;')
//         .replace(/,/g, '\\,')
//         .replace(/\r?\n/g, '\\n');
// }

// /**
//  * @param {object} opts
//  * @param {string} opts.ruleId         For deterministic UID per rule+day.
//  * @param {string} opts.ruleName       Used in calendar title.
//  * @param {object[]} opts.events       Same events array passed to the digest.
//  * @param {string} [opts.dashboardUrl] Deep link added to description.
//  * @param {string} [opts.organizerEmail]
//  * @param {string} [opts.attendeeEmail]
//  * @returns {{filename:string, content:string, contentType:string}}
//  */
// function buildCriticalAlertIcs(opts) {
//     const durationMin = opts.durationMinutes || 30;
//     const reminderMin = opts.reminderMinutes != null ? opts.reminderMinutes : 15;
//     const start = opts.scheduledAt instanceof Date ? opts.scheduledAt : nextTenAmIst();
//     const end = new Date(start.getTime() + durationMin * 60 * 1000);
//     const stamp = new Date();

//     const worst = opts.events.reduce((m, e) => {
//         const r = e.current_rating;
//         return r != null && r < (m ?? 99) ? r : m;
//     }, null);
//     const worstProduct = opts.events.find(e => e.current_rating === worst);

//     const dayKey = `${start.getUTCFullYear()}${String(start.getUTCMonth() + 1).padStart(2, '0')}${String(start.getUTCDate()).padStart(2, '0')}`;
//     const uid = `rating-critical-${opts.ruleId || 'rule'}-${dayKey}@ratings.trailytics.com`;

//     const titleProduct = worstProduct
//         ? ` · ${(worstProduct.product_name || worstProduct.web_pid || '').slice(0, 50)}`
//         : '';
//     const summary = `Review CRITICAL rating drop${titleProduct}`.slice(0, 150);

//     const descLines = [
//         `${opts.events.length} product${opts.events.length === 1 ? '' : 's'} tripped the rule "${opts.ruleName}".`,
//         worst != null ? `Worst rating in this digest: ${worst.toFixed(1)} stars.` : '',
//         '',
//         'Products affected:',
//         ...opts.events.slice(0, 8).map(e => {
//             const name = (e.product_name || e.web_pid || '?').slice(0, 70);
//             const r = e.current_rating != null ? e.current_rating.toFixed(1) : '?';
//             return `• ${name} (${r}★)`;
//         }),
//         opts.events.length > 8 ? `… and ${opts.events.length - 8} more` : '',
//         '',
//         opts.dashboardUrl ? `Dashboard: ${opts.dashboardUrl}` : '',
//     ].filter(Boolean).join('\n');

//     const organizer = opts.organizerEmail || process.env.SMTP_USER || 'no-reply@trailytics.com';
//     const attendee = opts.attendeeEmail;

//     const lines = [
//         'BEGIN:VCALENDAR',
//         'VERSION:2.0',
//         'PRODID:-//Trailytics//Rating Intelligence//EN',
//         'CALSCALE:GREGORIAN',
//         'METHOD:REQUEST',
//         'BEGIN:VEVENT',
//         `UID:${uid}`,
//         `DTSTAMP:${fmtIcsDate(stamp)}`,
//         `DTSTART:${fmtIcsDate(start)}`,
//         `DTEND:${fmtIcsDate(end)}`,
//         `SUMMARY:${escapeIcsText(summary)}`,
//         `DESCRIPTION:${escapeIcsText(descLines)}`,
//         `LOCATION:${escapeIcsText('Rating Intelligence dashboard')}`,
//         `URL:${opts.dashboardUrl || 'https://prestige-review.up.railway.app'}`,
//         'PRIORITY:1',
//         'STATUS:CONFIRMED',
//         'TRANSP:OPAQUE',
//         'CATEGORIES:Alert,Quality',
//         `ORGANIZER;CN=Rating Intelligence:mailto:${organizer}`,
//         attendee ? `ATTENDEE;CN=${escapeIcsText(attendee)};RSVP=FALSE:mailto:${attendee}` : '',
//         'BEGIN:VALARM',
//         'ACTION:DISPLAY',
//         `DESCRIPTION:${escapeIcsText('Review CRITICAL rating drops')}`,
//         `TRIGGER:-PT${reminderMin}M`,
//         'END:VALARM',
//         'END:VEVENT',
//         'END:VCALENDAR',
//     ].filter(Boolean).map(fold);

//     const content = lines.join('\r\n') + '\r\n';
//     return {
//         filename: 'rating-alert-review.ics',
//         content,
//         contentType: 'text/calendar; charset=utf-8; method=REQUEST',
//     };
// }

// module.exports = { buildCriticalAlertIcs };
