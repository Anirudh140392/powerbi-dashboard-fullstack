// src/utils/alertEmailTemplate.js
// Generates the dynamic sales_enablement-style HTML email for alert dispatches.
// All values are injected from live ClickHouse queries via alertDataService.

/**
 * Format IST timestamp for display (e.g. "05 Aug 2026 • 16:49 IST")
 */
const formatISTDisplay = (istDateTimeStr) => {
    if (!istDateTimeStr) return '';
    try {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        // istDateTimeStr format: "YYYY-MM-DD HH:mm:ss"
        const parts = istDateTimeStr.split(' ');
        const dateParts = parts[0].split('-');
        const timeParts = parts[1] ? parts[1].split(':') : ['00','00'];
        const day = parseInt(dateParts[2], 10);
        const month = months[parseInt(dateParts[1], 10) - 1];
        const year = dateParts[0];
        return `${String(day).padStart(2,'0')} ${month} ${year} • ${timeParts[0]}:${timeParts[1]} IST`;
    } catch {
        return istDateTimeStr;
    }
};

/**
 * Get severity color and label
 */
const getSeverityStyle = (severity) => {
    const s = String(severity || 'Warning').toLowerCase();
    if (s.includes('critical')) {
        return { bg: '#fff1f2', border: '#fecaca', color: '#dc2626', label: 'Critical', dotColor: '#dc2626' };
    }
    if (s.includes('high')) {
        return { bg: '#fff7ed', border: '#fed7aa', color: '#ea580c', label: 'High', dotColor: '#ea580c' };
    }
    if (s.includes('medium')) {
        return { bg: '#fffbeb', border: '#fde68a', color: '#d97706', label: 'Medium', dotColor: '#d97706' };
    }
    return { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', label: 'Low', dotColor: '#16a34a' };
};

/**
 * Generate delta indicator HTML
 * pill = true  → colored pill badge (for table cells)
 * pill = false → inline colored text (for header metrics)
 */
const deltaHtml = (delta, pill = false) => {
    if (delta === 0) return '';
    const isUp = delta > 0;
    const arrow = isUp ? '▲' : '▼';
    const absVal = Math.abs(delta).toFixed(1);
    if (pill) {
        const bg = isUp ? '#dcfce7' : '#fee2e2';
        const color = isUp ? '#16a34a' : '#dc2626';
        return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:${bg};color:${color};font-weight:700;font-size:8px;white-space:nowrap;margin-left:4px;">${arrow} ${absVal}%</span>`;
    }
    const color = isUp ? '#16a34a' : '#dc2626';
    return `<span style="color:${color};font-weight:700;">${arrow} ${absVal}%</span>`;
};

/**
 * Generate a single platform section with brand table + impacted SKU table.
 *
 * @param {string} platformName
 * @param {Array<{brand, currentOsa, previousOsa, delta}>} brandData
 * @param {Array<{skuName, brand, currentOsa, previousOsa, delta}>} skuData
 * @returns {string} HTML block
 */
const buildPlatformSection = (platformName, brandData, skuData) => {
    // Brand Performance table rows
    let brandRows = '';
    if (brandData && brandData.length > 0) {
        for (const b of brandData) {
            brandRows += `
        <tr>
          <td style="border-right:1px solid #e3ebf8;">${escapeHtml(b.brand)}</td>
          <td style="border-right:1px solid #e3ebf8; white-space:nowrap;">${b.currentOsa.toFixed(1)}% ${deltaHtml(b.delta, true)}</td>
          <td>${b.previousOsa.toFixed(1)}%</td>
        </tr>`;
        }
    } else {
        brandRows = '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:18px;">No brand data available</td></tr>';
    }

    // Impacted SKU table rows
    let skuRows = '';
    if (skuData && skuData.length > 0) {
        for (const s of skuData) {
            const salesLossFormatted = s.salesLoss ? `₹${Math.round(s.salesLoss).toLocaleString('en-IN')}` : '—';
            skuRows += `
        <tr>
          <td style="border-right:1px solid #e3ebf8;">${escapeHtml(s.skuName)}</td>
          <td style="border-right:1px solid #e3ebf8;">${escapeHtml(s.brand)}</td>
          <td style="border-right:1px solid #e3ebf8; white-space:nowrap;">${s.currentOsa.toFixed(1)}% ${deltaHtml(s.delta, true)}</td>
          <td style="color:#dc2626;font-weight:700;">${salesLossFormatted}</td>
        </tr>`;
        }
    } else {
        skuRows = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:18px;">No impacted SKUs found</td></tr>';
    }

    return `
<div class="platform">
  <div class="platform-title">${escapeHtml(platformName)}</div>

  <div class="table-card">
    <div class="section-title brand">Brand Performance</div>
    <table class="tbl" cellpadding="0" cellspacing="0" border="0">
      <colgroup><col style="width:34%"><col style="width:33%"><col style="width:33%"></colgroup>
      <thead>
        <tr><th style="border-right:1px solid #e3ebf8;">Brand Name</th><th style="border-right:1px solid #e3ebf8;">Current OSA</th><th>Previous OSA</th></tr>
      </thead>
      <tbody>
        ${brandRows}
      </tbody>
    </table>
  </div>

  <div class="table-card">
    <div class="section-title sku">Impacted SKUs</div>
    <table class="tbl" cellpadding="0" cellspacing="0" border="0">
      <colgroup><col style="width:28%"><col style="width:22%"><col style="width:28%"><col style="width:22%"></colgroup>
      <thead>
        <tr><th style="border-right:1px solid #e3ebf8;">SKU Name</th><th style="border-right:1px solid #e3ebf8;">Brand Name</th><th style="border-right:1px solid #e3ebf8;">Current OSA</th><th>Sales Loss</th></tr>
      </thead>
      <tbody>
        ${skuRows}
      </tbody>
    </table>
  </div>
</div>
`;
};

/**
 * Escape HTML entities to prevent XSS in dynamic content
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
 * Generate the full dynamic alert email HTML based on the sales_enablement template.
 *
 * @param {Object} data
 * @param {string} data.logoUrl - Company logo URL from tb_database
 * @param {string} data.companyName - Company/DB display name
 * @param {string} data.istNow - IST timestamp string "YYYY-MM-DD HH:mm:ss"
 * @param {string} data.alertName - Alert rule name
 * @param {string} data.severityLevel - "Critical", "High", "Medium", "Low"
 * @param {number} data.thresholdValue - Threshold percentage
 * @param {string} data.conditionalOperator - Operator symbol (e.g. ">", "<")
 * @param {{currentOsa: number, previousOsa: number, delta: number}} data.aggregateOsa
 * @param {Array<{platform: string, brands: Array, skus: Array}>} data.platformData
 *   Each platform entry contains:
 *     - platform: string (e.g. "Amazon")
 *     - brands: Array<{brand, currentOsa, previousOsa, delta}>
 *     - skus: Array<{skuName, brand, currentOsa, previousOsa, delta}>
 * @returns {string} Complete HTML email string
 */
export const generateAlertEmailHtml = (data) => {
    const {
        logoUrl = '',
        companyName = 'Trailytics',
        istNow = '',
        alertName = 'Low OSA Alert',
        severityLevel = 'Warning',
        thresholdValue = 85,
        conditionalOperator = '>',
        aggregateOsa = { currentOsa: 0, previousOsa: 0, delta: 0 },
        platformData = [],
    } = data;

    const severity = getSeverityStyle(severityLevel);
    const displayTime = formatISTDisplay(istNow);

    // Header delta display
    const headerDelta = aggregateOsa.delta;
    const headerDeltaColor = headerDelta >= 0 ? '#16a34a' : '#dc2626';
    const headerDeltaText = deltaHtml(headerDelta, false); // Contains the up/down arrow and color span

    // Build platform sections
    let platformSectionsHtml = '';
    for (const pd of platformData) {
        platformSectionsHtml += buildPlatformSection(pd.platform, pd.brands, pd.skus);
    }

    // If no platform data, show a fallback
    if (!platformSectionsHtml) {
        platformSectionsHtml = `
<div class="platform">
  <div class="platform-title">All Platforms</div>
  <div class="table-card">
    <div style="padding:18px;text-align:center;color:#94a3b8;">No platform-specific data available for this alert.</div>
  </div>
</div>`;
    }

    // Logo HTML: show company logo if available, otherwise show text
    const logoHtml = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)} Logo" width="110" style="display:block;max-width:110px;height:auto;border:0;outline:none;text-decoration:none;">`
        : `<div style="font-size:18px;font-weight:800;color:#1e5eff;">${escapeHtml(companyName)}</div>`;

    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(companyName)} - Alert Dispatch</title>
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
<style>
/* ==== CLIENT RESETS (Outlook / OWA / mobile) ==== */
html,body{margin:0 !important;padding:0 !important;width:100% !important;height:100% !important;}
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
table{border-collapse:collapse !important;}
img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
.ExternalClass{width:100%;}
.ExternalClass,.ExternalClass p,.ExternalClass span,.ExternalClass font,.ExternalClass td,.ExternalClass div{line-height:100%;}

body{margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#111827;font-size:12px;}
.email-bg{background:#f4f7fb;}
.container{max-width:640px;margin:auto}
.header{background:linear-gradient(#f8fbff,#eef6ff);border:1px solid #d7e6ff;border-radius:14px;padding:10px}
.header small{display:block;color:#4b74c9;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.header h1{margin:4px 0 2px;color:#1e5eff;font-size:18px}
.header p{margin:0;color:#667085;font-size:11px;}
.card{margin-top:10px;background:#fff;border:1px solid #e5edf8;border-radius:14px;padding:10px}
.top-table{width:100%;}
.top-table h2{margin:0;font-size:13px;word-break:break-word;overflow-wrap:break-word;}
.status{color:#dc2626;font-size:9px;font-weight:700;white-space:nowrap;text-align:right;}
.info{background:linear-gradient(180deg,#f8fbff,#edf5ff);border:1px solid #cfe0ff;border-radius:14px;padding:8px;margin:8px 0;box-shadow:0 8px 24px rgba(59,130,246,.08)}
.info-table{width:100%;table-layout:fixed;height:100%;}
.metric-cell{height:1px;}
.metric{background:#fff;border:1px solid #dde8fb;border-radius:10px;padding:8px;box-shadow:0 2px 8px rgba(15,23,42,.04);box-sizing:border-box;height:100%;}
.metric-title{font-size:8px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:.3px}
.metric-value{font-size:15px;font-weight:800;margin-top:3px;line-height:1.15;word-break:break-word;overflow-wrap:break-word;}
.metric-sub{margin-top:4px;font-size:8px;color:#64748b;word-break:break-word;overflow-wrap:break-word;}
.severity-badge{display:inline-block;padding:3px 9px;border-radius:999px;background:${severity.bg};border:1px solid ${severity.border};color:${severity.color};font-weight:700;font-size:9px;word-break:break-word;overflow-wrap:break-word;}
.lbl{font-size:8px;text-transform:uppercase;color:#64748b;font-weight:700}
.val{font-size:11px;font-weight:700;margin-top:2px}
.platform{margin-top:10px;border:1px solid #dbe7f6;border-radius:12px;background:#fbfdff;overflow:hidden}
.platform-title{background:#dbeafe;color:#1d4ed8;padding:6px 10px;font-size:10px;font-weight:700;border-bottom:1px solid #c7ddfe;word-break:break-word;overflow-wrap:break-word;}
.table-card{margin:6px;border:1px solid #e5eaf3;border-radius:8px;overflow:hidden;background:#fff}
.section-title{padding:5px 8px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
.brand{background:#eef4ff;color:#475569;border-bottom:1px solid #d9e6ff}
.sku{background:#f8fafc;color:#64748b;border-bottom:1px solid #e8eef7}
.tbl{width:100%;border-collapse:collapse;table-layout:fixed}
.tbl th{text-align:left;padding:5px 6px;color:#475569;font-size:7px;text-transform:uppercase;border-bottom:2px solid #d7e6ff;background:#f8fbff;word-break:break-word;overflow-wrap:break-word;}
.tbl td{text-align:left;padding:5px 6px;font-size:9px;border-bottom:1px solid #f3f4f6;word-break:break-word;overflow-wrap:break-word;}
.tbl tr:last-child td{border-bottom:none}
.up{color:#16a34a;font-size:7px;vertical-align:super}
.down{color:#dc2626;font-size:7px;vertical-align:super}
.summary{margin-top:10px;border:1px solid #d7e6ff;border-radius:10px;padding:6px;font-size:10px;}
.summary .t{font-size:8px;color:#1e5eff;font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px}
.footer{text-align:center;font-size:8px;color:#64748b;margin-top:8px}

/* ==== MOBILE (phones + narrow laptop panes) ==== */
@media only screen and (max-width:600px){
  .email-wrapper{width:100% !important;}
  .container{width:100% !important;}
  .header,.card{padding:8px !important;}
  .header img{width:100px !important;}
  .top-table h2{font-size:11px !important;}
  .status{font-size:8px !important;}
  .metric{padding:7px !important;}
  .metric-value{font-size:13px !important;}
  .metric-title{font-size:7px !important;}
  .metric-sub{font-size:7px !important;}
  .platform-title{font-size:9px !important;padding:6px 8px !important;}
  .table-card{margin:5px !important;}
  .tbl th,.tbl td{padding:4px 4px !important;font-size:7px !important;}
  .section-title{font-size:7px !important;padding:5px 8px !important;}
  .summary,.header{border-radius:10px !important;}
}
@media only screen and (max-width:380px){
  .metric-value{font-size:12px !important;}
  .header img{width:110px !important;}
}
</style>
</head>
<body class="email-bg" style="margin:0;padding:0;">
<center class="email-bg" style="width:100%;background:#f4f7fb;">
<!--[if mso]>
<table role="presentation" width="676" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
<![endif]-->
<div style="padding:18px;">
<div class="container email-wrapper" style="max-width:640px;margin:0 auto;">

<div class="header">
<small>INTELLIGENT ALERTS</small>
<div style="margin:4px 0 4px 0;">
${logoHtml}
</div>
<p style="margin-top:3px;">Intelligent Alert Dispatch</p>
<p style="margin-top:4px">${displayTime}</p>
</div>

<div class="card">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="top-table">
<tr>
<td style="vertical-align:middle;"><h2>${escapeHtml(alertName)}</h2></td>
<td style="vertical-align:middle;" class="status">● TRIGGERED</td>
</tr>
</table>

<div class="info">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="info-table">
<colgroup>
<col style="width:33.3%;">
<col style="width:2px;">
<col style="width:33.3%;">
<col style="width:2px;">
<col style="width:33.3%;">
</colgroup>
<tr>
<td class="metric-cell" style="vertical-align:top;padding:0 6px 0 0;">
<div class="metric">
<div class="metric-title">Current OSA</div>
<div class="metric-value">${aggregateOsa.currentOsa.toFixed(2)}%</div>
<div class="metric-sub">${headerDeltaText} vs previous</div>
</div>
</td>
<td class="metric-divider-cell" style="background:#b8d5ff;font-size:0;line-height:0;">&nbsp;</td>
<td class="metric-cell" style="vertical-align:top;padding:0 3px;">
<div class="metric">
<div class="metric-title">Alert Threshold</div>
<div class="metric-value">${escapeHtml(conditionalOperator)}${thresholdValue}%</div>
<div class="metric-sub">Trigger Condition Active</div>
</div>
</td>
<td class="metric-divider-cell" style="background:#b8d5ff;font-size:0;line-height:0;">&nbsp;</td>
<td class="metric-cell" style="vertical-align:top;padding:0 0 0 6px;">
<div class="metric">
<div class="metric-title">Severity</div>
<div style="margin-top:6px;"><span class="severity-badge">● ${severity.label}</span></div>
<div class="metric-sub">${severity.label === 'Critical' ? 'Immediate attention required' : severity.label === 'High' ? 'Requires attention soon' : 'Monitor and review'}</div>
</div>
</td>
</tr>
</table>
</div>

${platformSectionsHtml}

<div class="summary"><div class="t">Delivery Summary</div>Alert dispatched successfully for <b>${escapeHtml(companyName)}</b> with <b>${severity.label}</b> severity.</div>
</div>
<div class="footer">Automated alert generated by Trailytics</div>
</div>
</div>
<!--[if mso]>
</td></tr></table>
<![endif]-->
</center>
</body></html>`;
};
