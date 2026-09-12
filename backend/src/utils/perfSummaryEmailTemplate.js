// src/utils/perfSummaryEmailTemplate.js
// Generates the dynamic Performance Summary (qcomm_summary-style) HTML email.
// Renders one card per platform with 7 KPIs, severity-colored status bar,
// Market Share T-3 info tooltip, and compact number formatting.

/**
 * Format a number in compact Indian style: ₹32.07K, ₹1.5L, ₹2.3Cr
 */
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

/**
 * Format a plain number (no currency) in compact style
 */
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

/**
 * Format a percentage value with % suffix
 */
const formatPct = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return `${parseFloat(value).toFixed(1)}%`;
};

/**
 * Format a date string YYYY-MM-DD into "5 Aug 2026" display format
 */
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const month = months[parseInt(parts[1], 10) - 1] || '';
    return `${day} ${month} ${parts[0]}`;
};

/**
 * Get severity style for the status footer bar.
 */
const getSeverityStyle = (severity) => {
    const s = String(severity || 'Medium').toLowerCase();
    if (s.includes('critical')) return { color: '#DC3B3B', bg: '#FDE7E7', label: 'Critical' };
    if (s.includes('high'))     return { color: '#EA580C', bg: '#FFF7ED', label: 'High' };
    if (s.includes('medium'))   return { color: '#D97706', bg: '#FFFBEB', label: 'Medium' };
    return { color: '#157347', bg: '#E1F5EA', label: 'Nominal' };
};

/**
 * Build a single metric row in the platform card.
 */
const buildMetricRow = (label, svgIcon, currentFormatted, previousFormatted, delta, isAlt, extraLabelHtml = '') => {
    const bgColor = isAlt ? '#F6F8FD' : '#FFFFFF';
    
    let deltaHtml = '';
    if (delta !== 0 && !isNaN(delta) && delta !== null && delta !== undefined) {
        const isUp = delta > 0;
        const color = isUp ? '#157347' : '#DC3B3B';
        const pillBgColor = isUp ? '#E1F5EA' : '#FDE7E7';
        const arrow = isUp ? '&#9650;' : '&#9660;';
        const absVal = Math.abs(delta).toFixed(1);
        deltaHtml = `<td style="padding-left:4px;" valign="middle">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:${pillBgColor};">
<tr>
<td style="padding:4px 8px; font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:12px; color:${color}; line-height:16px; white-space:nowrap;" valign="middle">${arrow} ${absVal}%</td>
</tr>
</table>
</td>`;
    }

    return `
<!-- ${label} -->
<tr>
<td style="padding:11px 17px; background-color:${bgColor}; border-top:1px solid #EEF1FA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td width="36%" align="left" valign="middle">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td width="22" valign="middle">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:20px; height:20px; background-color:#EAF0FF;">
    <tr><td align="center" valign="middle" style="width:20px; height:20px; line-height:0;">
    ${svgIcon}
    </td></tr>
    </table>
    </td>
    <td style="padding-left:7px; font-family:Arial, Helvetica, sans-serif; font-size:10.5px; color:#16224A; font-weight:bold; white-space:nowrap;" valign="middle">${label}${extraLabelHtml}</td>
    </tr>
    </table>
    </td>
    <td width="38%" align="right" valign="middle">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right">
    <tr>
    <td style="font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:12px; color:#0B1B3F; white-space:nowrap;" valign="middle">${currentFormatted}</td>
    ${deltaHtml}
    </tr>
    </table>
    </td>
    <td width="26%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:10px; color:#5C6B94; white-space:nowrap;" valign="middle">${previousFormatted}</td>
    </tr>
</table>
</td>
</tr>`;
};

// Text-based fallback icons for email client compatibility
const iconText = (char, size) => 
    `<span style="font-size:${size}px; font-family:Arial, Helvetica, sans-serif; font-weight:bold; color:#2F5FEA; line-height:20px;">${char}</span>`;

const ICONS = {
    salesMrp: iconText('₹', 12),
    salesAsp: iconText('₹', 12),
    qtySold: iconText('#', 12),
    sov: iconText('★', 12),
    osa: iconText('✓', 11),
    discounting: iconText('%', 12),
    marketShare: iconText('●', 10),
};

// Market Share text (T-3)
const MS_INFO_ICON = `&nbsp;<span style="font-size:9.5px; color:#5C6B94; font-weight:bold; font-family:Arial, Helvetica, sans-serif;">(T-3)</span>`;

/**
 * Build a complete platform card with all 7 KPIs.
 */
const buildPlatformCard = (platformName, kpis, currentDateStr, previousDateStr, msCurrentDateStr, severityLevel, currency = '₹') => {
    const severity = getSeverityStyle(severityLevel);

    const rows = [
        buildMetricRow('Sales [MRP]', ICONS.salesMrp,
            formatCompact(kpis.salesMrp.current, currency),
            formatCompact(kpis.salesMrp.previous, currency),
            kpis.salesMrp.delta, false),
        buildMetricRow('Sales [ASP]', ICONS.salesAsp,
            formatCompact(kpis.salesAsp.current, currency),
            formatCompact(kpis.salesAsp.previous, currency),
            kpis.salesAsp.delta, true),
        buildMetricRow('Qty Sold', ICONS.qtySold,
            formatNumber(kpis.qtySold.current),
            formatNumber(kpis.qtySold.previous),
            kpis.qtySold.delta, false),
        buildMetricRow('SOV', ICONS.sov,
            formatPct(kpis.sov.current),
            formatPct(kpis.sov.previous),
            kpis.sov.delta, true),
        buildMetricRow('OSA', ICONS.osa,
            formatPct(kpis.osa.current),
            formatPct(kpis.osa.previous),
            kpis.osa.delta, false),
        buildMetricRow('Discounting', ICONS.discounting,
            formatPct(kpis.discounting.current),
            formatPct(kpis.discounting.previous),
            kpis.discounting.delta, true),
        buildMetricRow('Market Share', ICONS.marketShare,
            formatPct(kpis.marketShare.current),
            formatPct(kpis.marketShare.previous),
            kpis.marketShare.delta, false, MS_INFO_ICON),
    ];

    return `
<!-- CARD: ${platformName} -->
<tr>
<td style="padding-bottom:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF; box-shadow:0 12px 24px -10px rgba(31,74,216,0.18);">

<!-- Band header -->
<tr>
<td style="padding:13px 17px; background-color:#12295E; font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:14px; color:#FFFFFF;">${escapeHtml(platformName)}</td>
</tr>

<!-- Column headers -->
<tr>
<td style="padding:10px 17px 7px 17px; border-bottom:1.5px solid #C9D6FA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td width="36%" align="left" style="padding-left:29px; font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA;">METRIC</td>
    <td width="38%" align="right" style="padding-right:20px; font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA; white-space:nowrap;">CURRENT (T-1)</td>
    <td width="26%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA; white-space:nowrap;">PREVIOUS (LWD)</td>
    </tr>
</table>
</td>
</tr>

${rows.join('')}

    <!-- FOOTER -->
    <tr>
    <td style="height:16px; background-color:#12295E; font-size:1px; line-height:16px;">&nbsp;</td>
    </tr>

</table>
</td>
</tr>`;
};

/**
 * Escape HTML entities.
 */
const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

/**
 * Generate the full Performance Summary email HTML.
 */
export const generatePerfSummaryEmailHtml = (data) => {
    const {
        logoUrl = '',
        companyName = 'Trailytics',
        currentDate = '',
        previousDate = '',
        msCurrentDate = '',
        severityLevel = 'Medium',
        currency = '₹',
        platformCards = [],
    } = data;

    const currentDisplay = formatDateDisplay(currentDate);
    const previousDisplay = formatDateDisplay(previousDate);

    // Logo: hosted image or text fallback
    const logoHtml = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" width="140" height="28" alt="${escapeHtml(companyName)} Logo" style="display:block; border:0; outline:none; text-decoration:none;">`
        : `<span style="font-family:Arial, Helvetica, sans-serif; font-size:18px; font-weight:bold; color:#0B1E4D;">${escapeHtml(companyName)}</span>`;

    // Build all platform cards
    let cardsHtml = '';
    for (const card of platformCards) {
        cardsHtml += buildPlatformCard(
            card.platform,
            card.kpis,
            currentDisplay,
            previousDisplay,
            formatDateDisplay(msCurrentDate),
            severityLevel,
            currency
        );
    }

    if (!cardsHtml) {
        cardsHtml = `
<tr>
<td style="padding:20px; text-align:center; font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#5C6B94;">
No platform data available for this summary.
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
Weekly snapshot &middot; data as of ${currentDisplay} (T-1) vs ${previousDisplay}
</td>
<td valign="middle" align="right">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="background-color:#EAF0FF;">
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
