// src/utils/ptdPerfSummaryEmailTemplate.js
// Period-To-Date (PTD) Performance Summary email template.

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Delta (text only, green up / red down)
// ─────────────────────────────────────────────────────────────
const buildDelta = (delta, suffix = '%') => {
    if (delta === null || delta === undefined || isNaN(delta) || delta === 0) return '-';
    const isUp = delta > 0;
    const color = isUp ? '#157347' : '#DC3B3B';
    const arrow = isUp ? '&#9650;' : '&#9660;';
    const absVal = Math.abs(delta).toFixed(1);
    return `<span style="color:${color};">${arrow} ${absVal}${suffix}</span>`;
};

// ─────────────────────────────────────────────────────────────
// Section header row
// ─────────────────────────────────────────────────────────────
const buildSectionHeader = (title, isFirst) => {
    const borderTop = isFirst ? '' : 'border-top:1.5px solid #C9D6FA; ';
    return `
<tr>
<td bgcolor="#F5F7FC" style="padding:8px 17px; background-color:#F5F7FC; ${borderTop}border-bottom:1px solid #EEF1FA;">
<span style="font-family:Arial, Helvetica, sans-serif; font-size:9px; font-weight:bold; letter-spacing:.8px; text-transform:uppercase; color:#6B7A9E;">${escapeHtml(title)}</span>
</td>
</tr>`;
};

// ─────────────────────────────────────────────────────────────
// Column header row
// ─────────────────────────────────────────────────────────────
const buildColHeader = (col1, cpLabel, ppLabel) => `
<tr>
<td style="padding:10px 17px 7px 17px; border-bottom:1.5px solid #C9D6FA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="34%" align="left" style="font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA;">${escapeHtml(col1)}</td>
<td width="24%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA; white-space:nowrap;">Current Period</td>
<td width="24%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA; white-space:nowrap;">Previous Period</td>
<td width="18%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-size:8px; font-weight:bold; letter-spacing:.4px; text-transform:uppercase; color:#2F5FEA; white-space:nowrap;">DELTA</td>
</tr>
</table>
</td>
</tr>`;

// ─────────────────────────────────────────────────────────────
// Single metric row
// ─────────────────────────────────────────────────────────────
const buildMetricRow = (label, currentFmt, previousFmt, delta, isAlt, isFirst, deltaSuffix = '%') => {
    const bg = isAlt ? '#F8FAFD' : '#FFFFFF';
    const borderTop = isFirst ? '' : 'border-top:1px solid #EEF1FA;';
    return `
<tr>
<td bgcolor="${bg}" style="padding:11px 17px; background-color:${bg}; ${borderTop}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="34%" align="left" style="font-family:Arial, Helvetica, sans-serif; font-size:9.5px; color:#16224A; font-weight:bold;" valign="middle">${escapeHtml(label)}</td>
<td width="24%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:11px; color:#0B1B3F; white-space:nowrap;" valign="middle">${escapeHtml(currentFmt)}</td>
<td width="24%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:10px; color:#5C6B94; white-space:nowrap;" valign="middle">${escapeHtml(previousFmt)}</td>
<td width="18%" align="right" style="font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:10.5px; white-space:nowrap;" valign="middle">${buildDelta(delta, deltaSuffix)}</td>
</tr>
</table>
</td>
</tr>`;
};

// ─────────────────────────────────────────────────────────────
// Build one complete platform card
// ─────────────────────────────────────────────────────────────
const buildPlatformCard = (platformName, kpis, cpLabel, ppLabel, currency) => {
    const perfRows = [
        buildMetricRow('Offtake Units',     formatNumber(kpis.offtakeUnits.current),           formatNumber(kpis.offtakeUnits.previous),           kpis.offtakeUnits.delta, false, true),
        buildMetricRow('Offtake GMV',       formatCompact(kpis.offtakeGmv.current, currency),  formatCompact(kpis.offtakeGmv.previous, currency),  kpis.offtakeGmv.delta,   true,  false),
        buildMetricRow('Weighted Discount', formatPct(kpis.discount.current),                  formatPct(kpis.discount.previous),                  kpis.discount.delta,     false, false),
        buildMetricRow('OSA',               formatPct(kpis.osa.current),                       formatPct(kpis.osa.previous),                       kpis.osa.delta,          true,  false),
        buildMetricRow('Ad Spend',          formatCompact(kpis.adSpend.current, currency),     formatCompact(kpis.adSpend.previous, currency),     kpis.adSpend.delta,      false, false),
        buildMetricRow('TACoS',             formatPct(kpis.tacos.current),                     formatPct(kpis.tacos.previous),                     kpis.tacos.delta,        true,  false, 'pp'),
        buildMetricRow('Share Of Search',   formatPct(kpis.sos.current),                       formatPct(kpis.sos.previous),                       kpis.sos.delta,          false, false),
    ];

    const primaryRows = [
        buildMetricRow('Confirmed Value',   formatCompact(kpis.confirmedValue.current, currency),              formatCompact(kpis.confirmedValue.previous, currency),              kpis.confirmedValue.delta, false, true),
        buildMetricRow('Billed Value',      formatCompact(kpis.billedValue.current, currency),                 formatCompact(kpis.billedValue.previous, currency),                 kpis.billedValue.delta,    true,  false),
        buildMetricRow('Ordered Quantity',  formatNumber(kpis.orderedQty.current),                             formatNumber(kpis.orderedQty.previous),                             kpis.orderedQty.delta,     false, false),
        buildMetricRow('Confirmed Quantity',formatNumber(kpis.confirmedQty.current),                           formatNumber(kpis.confirmedQty.previous),                           kpis.confirmedQty.delta,   true,  false),
    ];

    return `
<!-- CARD: ${platformName} -->
<tr>
<td style="padding-bottom:16px;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" arcsize="2.3%" stroke="t" strokecolor="#E4E9F7" fillcolor="#FFFFFF" style="width:700px;">
<v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
<![endif]-->
<table bgcolor="#FFFFFF" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF; border:1px solid #E4E9F7; border-radius:16px; box-shadow:0 10px 20px -14px rgba(47,95,234,0.20);">

<!-- Band header -->
<tr>
<td bgcolor="#DCE9FE" style="padding:13px 17px; background-color:#DCE9FE; border-radius:16px 16px 0 0; font-family:Arial, Helvetica, sans-serif; font-weight:bold; font-size:15px; color:#173C9C;">${escapeHtml(platformName)}</td>
</tr>

${buildSectionHeader('PERFORMANCE METRICS', true)}
${buildColHeader('METRIC', cpLabel, ppLabel)}
${perfRows.join('')}

${buildSectionHeader('PRIMARY INFO', false)}
${buildColHeader('PRIMARY', cpLabel, ppLabel)}
${primaryRows.join('')}

<!-- Footer bar -->
<tr>
<td bgcolor="#FFFFFF" style="padding:12px 17px; background-color:#FFFFFF; border-top:1px solid #EEF1FA; border-radius:0 0 16px 16px; font-size:1px; line-height:1px;">&nbsp;</td>
</tr>

</table>
<!--[if mso]>
</v:textbox>
</v:roundrect>
<![endif]-->
</td>
</tr>`;
};

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────
export const generatePtdPerfSummaryEmailHtml = (data) => {
    const {
        logoUrl = '',
        companyName = 'Trailytics',
        cpStart = '',
        cpEnd = '',
        ppStart = '',
        ppEnd = '',
        currency = '₹',
        platformCards = [],
    } = data;

    const cpLabel = `${formatDateDisplay(cpStart)} – ${formatDateDisplay(cpEnd)}`;
    const ppLabel = `${formatDateDisplay(ppStart)} – ${formatDateDisplay(ppEnd)}`;

    const logoHtml = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" width="140" height="28" alt="${escapeHtml(companyName)} Logo" style="display:block; border:0; outline:none; text-decoration:none;">`
        : `<span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#0B1E4D;">${escapeHtml(companyName)}</span>`;

    let cardsHtml = '';
    for (const card of platformCards) {
        cardsHtml += buildPlatformCard(card.platform, card.kpis, cpLabel, ppLabel, currency);
    }

    if (!cardsHtml) {
        cardsHtml = `<tr><td style="padding:20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5C6B94;">No platform data available.</td></tr>`;
    }

    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(companyName)} — PTD Performance Summary</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
<o:AllowPNG/>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<!--[if mso]>
<style type="text/css">
  body, table, td, span, a { font-family: Arial, Helvetica, sans-serif !important; }
</style>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; mso-line-height-rule: exactly; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #EEF2FC; }
  table { border-collapse: collapse; border-spacing: 0; }
  @media screen and (max-width: 720px) {
    .email-container { width: 100% !important; max-width: 100% !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#EEF2FC;">
<table bgcolor="#EEF2FC" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF2FC;">
<tr>
<td align="center" style="padding:18px 12px;">

<!--[if mso]>
<table role="presentation" align="center" width="700" cellpadding="0" cellspacing="0" border="0"><tr><td>
<![endif]-->
<table role="presentation" class="email-container" width="700" align="center" cellpadding="0" cellspacing="0" border="0" style="width:700px; max-width:700px; margin:0 auto;">

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
Period-to-Date snapshot &middot; Current Period: ${escapeHtml(cpLabel)} vs Previous Period: ${escapeHtml(ppLabel)}
</td>
<td valign="middle" align="right">
<table bgcolor="#EAF0FF" role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="background-color:#EAF0FF; border-radius:999px;">
  <tr>
    <td style="padding:3px 8px 2px 8px; font-family:Arial, Helvetica, sans-serif; font-size:8px; letter-spacing:.9px; text-transform:uppercase; color:#2F5FEA; font-weight:bold; white-space:nowrap;">
      PTD SUMMARY
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
<td bgcolor="#2F5FEA" height="3" style="background-color:#2F5FEA; border-radius:3px; font-size:1px; line-height:3px;">&nbsp;</td>
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
Automated PTD performance summary generated by <strong>Trailytics</strong>
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
