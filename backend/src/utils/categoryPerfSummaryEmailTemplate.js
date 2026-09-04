// src/utils/categoryPerfSummaryEmailTemplate.js
// Generates the Performance Summary HTML email.
// Layout: Platform section header > Category sub-header > 6 KPI metric table.
// KPIs: Offtake Units, Offtake GMV, Weighted Discount, OSA, Ad Spend & TACoS, SOS.

const formatCompact = (value, currency = '₹') => {
    if (value === null || value === undefined || isNaN(value)) return `${currency}0`;
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e7) return `${sign}${currency}${(abs / 1e7).toFixed(1)}Cr`;
    if (abs >= 1e5) return `${sign}${currency}${(abs / 1e5).toFixed(1)}L`;
    if (abs >= 1e3) return `${sign}${currency}${(abs / 1e3).toFixed(1)}K`;
    const hasDecimal = abs % 1 !== 0;
    return `${sign}${currency}${hasDecimal ? abs.toFixed(1) : abs.toString()}`;
};

const formatNumber = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(1)}Cr`;
    if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1)}L`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
    const hasDecimal = abs % 1 !== 0;
    return `${sign}${hasDecimal ? abs.toFixed(1) : abs.toLocaleString('en-IN')}`;
};

const formatPct = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return `${parseFloat(value).toFixed(1)}%`;
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

const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

/**
 * Build a single metric row in the table.
 * @param {string} label - Row label
 * @param {string} currentFormatted - CW value
 * @param {string} previousFormatted - L4W value
 * @param {number} delta - Delta value
 * @param {boolean} isAlt - Alternate row background
 * @param {string} extraHtml - Extra HTML below CW/L4W values (for TACoS sub-line)
 */
const buildMetricRow = (label, currentFormatted, previousFormatted, delta, isAlt, extraCurrentHtml = '', extraPreviousHtml = '', extraDeltaHtml = '', isTacos = false) => {
    const bgColor = isAlt ? '#F8FAFD' : '#FFFFFF';

    let deltaHtml = '';
    if (delta !== 0 && !isNaN(delta) && delta !== null && delta !== undefined) {
        const isUp = delta > 0;
        const color = (isTacos ? (isUp ? '#DC3B3B' : '#157347') : (isUp ? '#157347' : '#DC3B3B'));
        let arrow = isUp ? '&#9650;' : '&#9660;';
        const absVal = Math.abs(delta).toFixed(1);
        const unit = isTacos ? 'pp' : '%';
        deltaHtml = `<td width="18%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:11px; color:${color}; white-space:nowrap;" valign="top">${arrow} ${absVal}${unit}${extraDeltaHtml}</td>`;
    } else {
        const unit = isTacos ? 'pp' : '%';
        deltaHtml = `<td width="18%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:11px; color:#5C6B94; white-space:nowrap;" valign="top">0.0${unit}${extraDeltaHtml}</td>`;
    }

    return `
<!-- ${label} -->
<tr>
<td style="padding:11px 17px; background-color:${bgColor}; border-top:1px solid #EEF1FA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="34%" align="left" style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#16224A; font-weight:bold;" valign="top">${label}</td>
<td width="24%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:11.5px; color:#0B1B3F; white-space:nowrap;" valign="top">${currentFormatted}${extraCurrentHtml}</td>
<td width="24%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:10.5px; color:#5C6B94; white-space:nowrap;" valign="top">${previousFormatted}${extraPreviousHtml}</td>
${deltaHtml}
</tr>
</table>
</td>
</tr>`;
};

/**
 * Build a category card (table) inside a platform section.
 */
const buildCategoryTable = (categoryName, kpis, currency = '₹') => {
    const rows = [
        buildMetricRow('1. Offtake Units',
            formatNumber(kpis.qtySold.current),
            formatNumber(kpis.qtySold.previous),
            kpis.qtySold.delta, false),
        buildMetricRow('2. Offtake GMV',
            formatCompact(kpis.gmv.current, currency),
            formatCompact(kpis.gmv.previous, currency),
            kpis.gmv.delta, true),
        buildMetricRow('3. Weighted Discount',
            formatPct(kpis.discounting.current),
            formatPct(kpis.discounting.previous),
            kpis.discounting.delta, false),
        buildMetricRow('4. OSA',
            formatPct(kpis.osa.current),
            formatPct(kpis.osa.previous),
            kpis.osa.delta, true),
        buildMetricRow('5. Ad Spend',
            formatCompact(kpis.adSpend.current, currency),
            formatCompact(kpis.adSpend.previous, currency),
            kpis.adSpend.delta, false),
        buildMetricRow('6. TACoS',
            formatPct(kpis.tacos.current),
            formatPct(kpis.tacos.previous),
            kpis.tacos.delta, true, '', '', '', true),
        buildMetricRow('7. SOS',
            formatPct(kpis.sos.current),
            formatPct(kpis.sos.previous),
            kpis.sos.delta, false),
    ];

    return `
<!-- Category: ${escapeHtml(categoryName)} -->
<tr>
<td style="padding:0 0 12px 0;">

<!-- Category title -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:12px 17px; background-color:#F4F7FE; font-family:Arial, Helvetica, sans-serif; font-size:12px; font-weight:bold; color:#16224A; letter-spacing:0.2px; text-transform:uppercase;">
${escapeHtml(String(categoryName || '').toUpperCase())}
</td>
</tr>
</table>

<!-- Column headers -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding:10px 17px 7px 17px; border-bottom:1.5px solid #C9D6FA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="34%" align="left" style="font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA;">METRIC</td>
<td width="24%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA; white-space:nowrap;">Current Week</td>
<td width="24%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA; white-space:nowrap;">Prev Week</td>
<td width="18%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA; white-space:nowrap;">DELTA</td>
</tr>
</table>
</td>
</tr>
</table>

<!-- Metric rows -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows.join('')}
</table>

</td>
</tr>`;
};

/**
 * Build the insight narrative block for a platform.
 * Max 3 concise narrative lines derived from aggregated KPI data.
 *
 * Line 1 — GMV direction + ad spend context (one breath)
 * Line 2 — Discount driver: volume-led vs discount-led call
 * Line 3 — Category leader + SOS signal
 */
const buildPlatformInsights = (categoryCards) => {
    if (!categoryCards || categoryCards.length === 0) return '';

    const r1 = (v) => parseFloat(parseFloat(v).toFixed(1));
    const sign = (v) => v >= 0 ? '+' : '';

    // ── 1. Aggregate platform totals ───────────────────────────────
    let totalCwGmv = 0, totalPwGmv = 0;
    let totalCwUnits = 0, totalPwUnits = 0;
    let totalCwAdSpend = 0, totalPwAdSpend = 0;

    for (const card of categoryCards) {
        const k = card.kpis;
        totalCwGmv     += k.gmv.current;
        totalPwGmv     += k.gmv.previous;
        totalCwUnits   += k.qtySold.current;
        totalPwUnits   += k.qtySold.previous;
        totalCwAdSpend += k.adSpend.current;
        totalPwAdSpend += k.adSpend.previous;
    }

    const gmvDelta   = totalPwGmv      > 0 ? r1(((totalCwGmv - totalPwGmv) / totalPwGmv) * 100)               : 0;
    const unitsDelta = totalPwUnits    > 0 ? r1(((totalCwUnits - totalPwUnits) / totalPwUnits) * 100)           : 0;
    const adDelta    = totalPwAdSpend  > 0 ? r1(((totalCwAdSpend - totalPwAdSpend) / totalPwAdSpend) * 100)     : 0;

    // ── 2. Per-category signals ────────────────────────────────────
    // Best category by GMV % delta
    const sorted = [...categoryCards].sort((a, b) => {
        const da = a.kpis.gmv.previous > 0 ? (a.kpis.gmv.current - a.kpis.gmv.previous) / a.kpis.gmv.previous : 0;
        const db = b.kpis.gmv.previous > 0 ? (b.kpis.gmv.current - b.kpis.gmv.previous) / b.kpis.gmv.previous : 0;
        return db - da;
    });
    const bestCat = sorted[0];

    // Average discount delta (volume-led vs discount-led signal)
    const discDeltas = categoryCards.map(c => c.kpis.discounting.delta);
    const avgDiscDelta = discDeltas.length > 0
        ? r1(discDeltas.reduce((s, v) => s + v, 0) / discDeltas.length)
        : 0;

    const sosSorted = [...categoryCards].sort((a, b) => b.kpis.sos.current - a.kpis.sos.current);
    const sosLeader = sosSorted[0];

    // ── 3. Compose 2 concise Raksha Bandhan-contextualised lines ──
    const sentences = [];

    // fmt(delta) → always produces '+X.X' or '-X.X'
    const fmt = (v) => `${v >= 0 ? '+' : ''}${r1(v).toFixed(1)}`;

    const gmvAbs  = Math.abs(gmvDelta).toFixed(1);
    const unitFmt = fmt(unitsDelta);                        // e.g. +22.3 or -31.0
    const adAbs   = Math.abs(adDelta).toFixed(1);
    const adWord  = adDelta >= 0 ? 'also rose' : 'declined';

    // — Line 1: GMV + units + ad spend, Raksha Bandhan as the cause —
    if (gmvDelta >= 0) {
        // Growth platform: Raksha Bandhan drove demand, ad spend chased the window
        const adContext = adDelta >= 0
            ? `ad spend rose <strong>${adAbs}%</strong> to amplify the festive gifting window.`
            : `ad spend was optimised down <strong>${adAbs}%</strong> even as organic demand surged.`;
        sentences.push(
            `Sales <strong>grew ${gmvAbs}% WoW</strong> (units ${unitFmt}%), with <strong>Raksha Bandhan</strong> ` +
            `driving festive gifting demand; ${adContext}`
        );
    } else {
        // Decline platform: sharp post-Raksha Bandhan normalisation
        const adContext = adDelta >= 0
            ? `ad spend was held up <strong>${adAbs}%</strong> despite the post-festival sales drop.`
            : `ad spend ${adWord} <strong>${adAbs}%</strong> as festive budgets wound down.`;
        sentences.push(
            `Sales <strong>fell ${gmvAbs}% WoW</strong> (units ${unitFmt}%) following the sharp ` +
            `post-<strong>Raksha Bandhan</strong> demand normalisation; ${adContext}`
        );
    }

    // — Line 2: Category leader + 2nd category contrast + discount context —
    if (bestCat) {
        const bestDelta  = r1(bestCat.kpis.gmv.delta);
        const discAbs    = Math.abs(avgDiscDelta).toFixed(1);

        // Discount context suffix
        const discSuffix = Math.abs(avgDiscDelta) < 0.2
            ? ', with discounts held broadly stable'
            : avgDiscDelta > 0
                ? `, aided by a ${discAbs}pp discount increase`
                : `, even as discounts were reined in by ${discAbs}pp`;

        // Second-best category as "smaller but efficient contribution" (growth) or runner-up (decline)
        const secondCat = sorted[1];
        let secondSuffix = '';
        if (secondCat && secondCat.categoryName !== bestCat.categoryName) {
            const secondDelta = r1(secondCat.kpis.gmv.delta);
            secondSuffix = gmvDelta >= 0
                ? `; <strong>${escapeHtml(secondCat.categoryName)}</strong> provided a smaller but efficient incremental contribution (${fmt(secondDelta)}% WoW)`
                : `; <strong>${escapeHtml(secondCat.categoryName)}</strong> also weighed in (${fmt(secondDelta)}% WoW)`;
        }

        const engineWord = gmvDelta >= 0 ? 'the primary gifting growth engine' : 'the most resilient category';

        sentences.push(
            `<strong>${escapeHtml(bestCat.categoryName)}</strong> was ${engineWord} ` +
            `(${fmt(bestDelta)}% GMV WoW)${discSuffix}${secondSuffix} during the Raksha Bandhan week.`
        );
    }

    // ── 4. Render HTML ─────────────────────────────────────────────
    const bulletHtml = sentences
        .map(s => `<tr><td style="padding:4px 0; font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#16224A; line-height:1.6;">&bull;&nbsp;${s}</td></tr>`)
        .join('\n');

    return `
<!-- Platform Insights -->
<tr>
<td style="padding:12px 17px 11px 17px; background-color:#F7F9FF; border-top:1px solid #DCE9FE; border-bottom:2px solid #DCE9FE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding-bottom:6px; font-family:Arial,Helvetica,sans-serif; font-size:9px; font-weight:bold; letter-spacing:.6px; text-transform:uppercase; color:#2F5FEA;">Platform Insights</td>
</tr>
${bulletHtml}
</table>
</td>
</tr>`;
};

/**
 * Build a platform card with all its categories.
 */
const buildPlatformSection = (platformName, categoryCards, currency = '₹') => {
    let categoriesHtml = '';
    for (const card of categoryCards) {
        categoriesHtml += buildCategoryTable(card.categoryName, card.kpis, currency);
    }

    const insightsHtml = buildPlatformInsights(categoryCards);

    return `
<!-- PLATFORM: ${escapeHtml(platformName)} -->
<tr>
<td style="padding-bottom:20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF; border:1px solid #E4E9F7; box-shadow:0 10px 20px -14px rgba(47,95,234,0.20);">

<!-- Platform header band -->
<tr>
<td style="padding:14px 17px; background-color:#DCE9FE; font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:15px; color:#173C9C; letter-spacing:0.3px;">
${escapeHtml(platformName)}
</td>
</tr>

${insightsHtml}

<!-- Category tables -->
${categoriesHtml}

<!-- Card footer -->
<tr>
<td style="padding:8px 17px; background-color:#FFFFFF; border-top:1px solid #EEF1FA; font-size:1px; line-height:1px;">&nbsp;</td>
</tr>

</table>
</td>
</tr>`;
};

/**
 * Generate the full Performance Summary email HTML.
 */
export const generateCategoryPerfSummaryEmailHtml = (data) => {
    const {
        logoUrl = '',
        companyName = 'Trailytics',
        cwStart = '',
        cwEnd = '',
        l4wStart = '',
        l4wEnd = '',
        currency = '₹',
        platformCategoryCards = [],
    } = data;

    const currentDisplay = `${formatDateDisplay(cwStart)} – ${formatDateDisplay(cwEnd)}`;
    const previousDisplay = `${formatDateDisplay(l4wStart)} – ${formatDateDisplay(l4wEnd)}`;

    const logoHtml = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" width="140" height="28" alt="${escapeHtml(companyName)} Logo" style="display:block; border:0; outline:none; text-decoration:none;">`
        : `<span style="font-family:Arial, Helvetica, sans-serif; font-size:18px; font-weight:bold; color:#0B1E4D;">${escapeHtml(companyName)}</span>`;

    // Group cards by platform
    const platformMap = new Map();
    for (const card of platformCategoryCards) {
        const plat = card.platform;
        if (!platformMap.has(plat)) platformMap.set(plat, []);
        platformMap.get(plat).push(card);
    }

    let cardsHtml = '';
    for (const [platformName, cards] of platformMap) {
        cardsHtml += buildPlatformSection(platformName, cards, currency);
    }

    if (!cardsHtml) {
        cardsHtml = `
<tr>
<td style="padding:20px; text-align:center; font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#5C6B94;">
No category data available for this summary.
</td>
</tr>`;
    }

    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(companyName)} — Quick Commerce Performance Summary</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #EEF2FC; }
  table { border-collapse: collapse; border-spacing: 0; }
  @media screen and (max-width: 500px) {
    .email-container { width: 100% !important; max-width: 100% !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#EEF2FC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF2FC;">
<tr>
<td align="center" style="padding:18px 12px;">

<!--[if mso]>
<table role="presentation" align="center" width="500" cellpadding="0" cellspacing="0" border="0"><tr><td>
<![endif]-->
<table role="presentation" class="email-container" width="100%" align="center" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:500px; margin:0 auto;">

<!-- MASTHEAD -->
<tr>
<td style="padding:4px 0 14px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td valign="middle" align="left" style="padding-bottom:12px;">
${logoHtml}
</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td valign="middle" align="left" style="font-family:Arial, Helvetica, sans-serif; font-size:9.5px; color:#5C6B94;">
Weekly snapshot &middot; CW as of ${currentDisplay} vs PW (${previousDisplay})
</td>
<td valign="middle" align="right">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="background-color:#EAF0FF; border-radius:999px;">
  <tr>
    <td style="padding:3px 8px 2px 8px; font-family:Arial, Helvetica, sans-serif; font-size:8px; letter-spacing:.9px; text-transform:uppercase; color:#2F5FEA; font-weight:bold; white-space:nowrap;">
      QUICK COMMERCE
    </td>
  </tr>
</table>
</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td height="10" style="font-size:1px; line-height:10px;">&nbsp;</td>
</tr>
<tr>
<td height="3" style="background-color:#2F5FEA; border-radius:3px; font-size:1px; line-height:3px;">&nbsp;</td>
</tr>
</table>
</td>
</tr>

${cardsHtml}

<!-- GLOBAL FOOTER -->
<tr>
<td align="center" style="padding:10px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="font-family:Arial, Helvetica, sans-serif; font-size:9px; color:#5C6B94;">
Automated performance summary generated by <strong>Trailytics</strong>
</td>
</tr>
</table>
</td>
</tr>

</table>
<!--[if mso]>
</td></tr></table>
<![endif]-->

</td>
</tr>
</table>
</body>
</html>`;
};
