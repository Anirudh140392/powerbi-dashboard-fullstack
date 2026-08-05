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
 * Generate delta indicator HTML (up arrow green / down arrow red)
 */
const deltaHtml = (delta, sup = false) => {
    if (delta === 0) return '';
    const isUp = delta > 0;
    const cls = isUp ? 'up' : 'down';
    const arrow = isUp ? '↑' : '↓';
    const absVal = Math.abs(delta).toFixed(1);
    if (sup) {
        return `<sup class="${cls}">${arrow}${absVal}%</sup>`;
    }
    const color = isUp ? '#16a34a' : '#dc2626';
    return `<span style="color:${color};font-weight:700;">▼ ${absVal}%</span>`;
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
          <td>${escapeHtml(b.brand)}</td>
          <td>${b.currentOsa.toFixed(1)}% ${deltaHtml(b.delta, true)}</td>
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
            skuRows += `
        <tr>
          <td>${escapeHtml(s.skuName)}</td>
          <td>${escapeHtml(s.brand)}</td>
          <td>${s.currentOsa.toFixed(1)}% ${deltaHtml(s.delta, true)}</td>
        </tr>`;
        }
    } else {
        skuRows = '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:18px;">No impacted SKUs found</td></tr>';
    }

    return `
<div class="platform">
  <div class="platform-title">${escapeHtml(platformName)}</div>

  <div class="table-card">
    <div class="section-title brand">Brand Performance</div>
    <table class="tbl">
      <colgroup><col style="width:42%"><col style="width:29%"><col style="width:29%"></colgroup>
      <thead>
        <tr><th>Brand Name</th><th>Current OSA</th><th>Previous OSA</th></tr>
      </thead>
      <tbody>
        ${brandRows}
      </tbody>
    </table>
  </div>

  <div class="table-card">
    <div class="section-title sku">Impacted SKUs</div>
    <table class="tbl">
      <colgroup><col style="width:42%"><col style="width:29%"><col style="width:29%"></colgroup>
      <thead>
        <tr><th>SKU Name</th><th>Brand Name</th><th>Current OSA</th></tr>
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
    const headerDeltaArrow = headerDelta >= 0 ? '▲' : '▼';
    const headerDeltaText = `${headerDeltaArrow} ${Math.abs(headerDelta).toFixed(1)}%`;

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
        ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)} Logo" width="180" style="display:block;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;">`
        : `<div style="font-size:28px;font-weight:800;color:#1e5eff;">${escapeHtml(companyName)}</div>`;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(companyName)} - Alert Dispatch</title>
<style>
body{margin:0;padding:18px;background:#f4f7fb;font-family:Arial,sans-serif;color:#111827}
.container{max-width:640px;margin:auto}
.header{background:linear-gradient(#f8fbff,#eef6ff);border:1px solid #d7e6ff;border-radius:18px;padding:22px}
.header small{display:block;color:#4b74c9;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.header h1{margin:8px 0 4px;color:#1e5eff;font-size:40px}
.header p{margin:0;color:#667085}
.card{margin-top:14px;background:#fff;border:1px solid #e5edf8;border-radius:16px;padding:18px}
.top{display:flex;justify-content:space-between;align-items:center}
.status{color:#dc2626;font-size:12px;font-weight:700}
.info{display:flex;gap:18px;background:linear-gradient(180deg,#f8fbff,#edf5ff);border:1px solid #cfe0ff;border-radius:18px;padding:18px;margin:18px 0;box-shadow:0 8px 24px rgba(59,130,246,.08)}
.metric{flex:1;background:#fff;border:1px solid #dde8fb;border-radius:14px;padding:18px;position:relative;box-shadow:0 2px 8px rgba(15,23,42,.04)}
.metric:not(:last-child):after{content:"";position:absolute;right:-9px;top:18%;height:64%;width:1px;background:linear-gradient(to bottom,transparent,#b8d5ff,transparent)}
.metric-title{font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:1px}
.metric-value{font-size:40px;font-weight:800;margin-top:6px;line-height:1}
.metric-sub{margin-top:8px;font-size:12px;color:#64748b}
.severity-badge{display:inline-block;padding:8px 16px;border-radius:999px;background:${severity.bg};border:1px solid ${severity.border};color:${severity.color};font-weight:700}
.lbl{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700}
.val{font-size:18px;font-weight:700;margin-top:4px}
.platform{margin-top:18px;border:1px solid #dbe7f6;border-radius:14px;background:#fbfdff;overflow:hidden}
.platform-title{background:#dbeafe;color:#1d4ed8;padding:12px 16px;font-size:18px;font-weight:700;border-bottom:1px solid #c7ddfe}
.table-card{margin:14px;border:1px solid #e5eaf3;border-radius:10px;overflow:hidden;background:#fff}
.section-title{padding:11px 14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.brand{background:#eef4ff;color:#475569;border-bottom:1px solid #d9e6ff}
.sku{background:#f8fafc;color:#64748b;border-bottom:1px solid #e8eef7}
.tbl{width:100%;border-collapse:collapse;table-layout:fixed}
.tbl th{text-align:left;padding:12px 14px;color:#475569;font-size:11px;text-transform:uppercase;border-bottom:2px solid #d7e6ff;background:#f8fbff}.tbl th:not(:last-child),.tbl td:not(:last-child){border-right:1px solid #e3ebf8}
.tbl td{text-align:left;padding:11px 14px;border-bottom:1px solid #f3f4f6}
.tbl tr:last-child td{border-bottom:none}
.up{color:#16a34a;font-size:10px;vertical-align:super}
.down{color:#dc2626;font-size:10px;vertical-align:super}
.summary{margin-top:18px;border:1px solid #d7e6ff;border-radius:12px;padding:14px}
.summary .t{font-size:11px;color:#1e5eff;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.footer{text-align:center;font-size:11px;color:#64748b;margin-top:12px}
</style></head><body>
<div class="container">
<div class="header"><small>INTELLIGENT ALERTS</small><div style="margin:10px 0 8px 0;">
${logoHtml}
</div>
<p style="margin-top:6px;">Intelligent Alert Dispatch</p><p style="margin-top:8px">${displayTime}</p></div>
<div class="card">
<div class="top"><h2 style="margin:0">${escapeHtml(alertName)}</h2><div class="status">● TRIGGERED</div></div>
<div class="info">
<div class="metric">
<div class="metric-title">Current OSA</div>
<div class="metric-value">${aggregateOsa.currentOsa.toFixed(2)}%</div>
<div class="metric-sub"><span style="color:${headerDeltaColor};font-weight:700;">${headerDeltaText}</span> vs previous</div>
</div>
<div class="metric">
<div class="metric-title">Alert Threshold</div>
<div class="metric-value">${escapeHtml(conditionalOperator)}${thresholdValue}%</div>
<div class="metric-sub">Trigger Condition Active</div>
</div>
<div class="metric">
<div class="metric-title">Severity</div>
<div style="margin-top:10px;"><span class="severity-badge">● ${severity.label}</span></div>
<div class="metric-sub">${severity.label === 'Critical' ? 'Immediate attention required' : severity.label === 'High' ? 'Requires attention soon' : 'Monitor and review'}</div>
</div>
</div>

${platformSectionsHtml}

<div class="summary"><div class="t">Delivery Summary</div>Alert dispatched successfully for <b>${escapeHtml(companyName)}</b> with <b>${severity.label}</b> severity.</div>
</div>
<div class="footer">Automated alert generated by Trailytics</div>
</div></body></html>`;
};
