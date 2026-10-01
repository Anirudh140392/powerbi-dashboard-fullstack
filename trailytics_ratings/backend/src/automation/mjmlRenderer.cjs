// /**
//  * MJML renderer — compiles the template string from emailTemplates/*.cjs
//  * into Outlook-safe HTML. mjml@5 returns a Promise.
//  *
//  * Validation errors are logged but never throw — a partially-rendered
//  * digest is still better than a 500 on the trigger.
//  */
// const mjml = require('mjml');
// const { buildDigestMjml } = require('./emailTemplates/ratingDigest.cjs');

// async function renderDigestHtml(rule, events, opts = {}) {
//     const mjmlString = buildDigestMjml(rule, events, opts);
//     const result = await mjml(mjmlString, {
//         validationLevel: 'soft',
//         keepComments: false,
//         minify: true,
//     });
//     if (result.errors && result.errors.length) {
//         console.warn('[mjmlRenderer] non-fatal MJML errors:', result.errors.slice(0, 3));
//     }
//     return result.html;
// }

// module.exports = { renderDigestHtml };
