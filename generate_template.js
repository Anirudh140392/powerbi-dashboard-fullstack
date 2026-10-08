const fs = require('fs');
const html = fs.readFileSync('backend/src/sales_enablement.html', 'utf8');

// The HTML contains {{...}} placeholders.
// Let's split it into parts: header, platform section, footer.

const platformStart = '<!-- {{PLATFORM_SECTIONS_START}} -->';
const platformEnd = '<!-- {{PLATFORM_SECTIONS_END}} -->';

const startIndex = html.indexOf(platformStart);
const endIndex = html.indexOf(platformEnd) + platformEnd.length;

const beforePlatform = html.substring(0, startIndex);
const platformTemplate = html.substring(startIndex, endIndex);
const afterPlatform = html.substring(endIndex);

// We need to modify platformTemplate:
// 1. Remove BRAND PERFORMANCE block
const brandStart = '<!-- BRAND PERFORMANCE -->';
const brandEnd = '<!-- IMPACTED SKUS -->';
const brandIndex = platformTemplate.indexOf(brandStart);
const brandEndIndex = platformTemplate.indexOf(brandEnd);
const platformNoBrand = platformTemplate.substring(0, brandIndex) + platformTemplate.substring(brandEndIndex);

// Let's formulate the new alertEmailTemplate.js content
let jsContent = `// src/utils/alertEmailTemplate.js
// Generates the dynamic sales_enablement-style HTML email for alert dispatches.
// All values are injected from live ClickHouse queries via alertDataService.

const formatISTDisplay = (istDateTimeStr) => {
    if (!istDateTimeStr) return '';
    try {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const parts = istDateTimeStr.split(' ');
        const dateParts = parts[0].split('-');
        const timeParts = parts[1] ? parts[1].split(':') : ['00','00'];
        const day = parseInt(dateParts[2], 10);
        const month = months[parseInt(dateParts[1], 10) - 1];
        const year = dateParts[0];
        return \`\${String(day).padStart(2,'0')} \${month} \${year} • \${timeParts[0]}:\${timeParts[1]} IST\`;
    } catch {
        return istDateTimeStr;
    }
};

const getSeverityStyle = (severity) => {
    const s = String(severity || 'Warning').toLowerCase();
    if (s.includes('critical')) {
        return { bg: '#fff1f2', border: '#fecaca', color: '#dc2626', label: 'Critical', desc: 'Immediate attention required' };
    }
    if (s.includes('high')) {
        return { bg: '#fff7ed', border: '#fed7aa', color: '#ea580c', label: 'High', desc: 'Requires attention soon' };
    }
    if (s.includes('medium')) {
        return { bg: '#fffbeb', border: '#fde68a', color: '#d97706', label: 'Medium', desc: 'Monitor and review' };
    }
    return { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', label: 'Low', desc: 'No immediate action needed' };
};

const deltaHtml = (delta, forTable = false) => {
    if (delta === 0) return '';
    const isUp = delta > 0;
    const arrow = isUp ? '▲' : '▼';
    const absVal = Math.abs(delta).toFixed(1);
    const color = isUp ? '#16a34a' : '#dc2626';
    
    if (forTable) {
        return \`<sup style="color:\${color};font-size:7px;line-height:0;vertical-align:super;">\${arrow} \${absVal}%</sup>\`;
    }
    return \`<span style="color:\${color};font-weight:700;">\${arrow} \${absVal}%</span>\`;
};

const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

const buildPlatformSection = (platformName, skuData) => {
    if (!skuData || skuData.length === 0) return '';

    let skuRows = '';
    for (const s of skuData) {
        const salesLossFormatted = s.salesLoss ? \`₹\${Math.round(s.salesLoss).toLocaleString('en-IN')}\` : '—';
        skuRows += \`<tr>
<td style="padding:5px 6px;border-right:1px solid #e3ebf8;border-bottom:1px solid #f3f4f6;font-family:Arial,sans-serif;color:#111827;font-size:9px;line-height:12px;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    \${escapeHtml(s.skuName)}
</td>
<td style="padding:5px 6px;border-right:1px solid #e3ebf8;border-bottom:1px solid #f3f4f6;font-family:Arial,sans-serif;color:#111827;font-size:9px;line-height:12px;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    \${escapeHtml(s.brand)}
</td>
<td style="padding:5px 6px;border-right:1px solid #e3ebf8;border-bottom:1px solid #f3f4f6;font-family:Arial,sans-serif;color:#111827;font-size:9px;line-height:12px;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    \${s.currentOsa.toFixed(1)}% \${deltaHtml(s.delta, true)}
</td>
<td style="padding:5px 6px;border-bottom:1px solid #f3f4f6;font-family:Arial,sans-serif;color:#dc2626;font-size:9px;line-height:12px;font-weight:700;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    \${salesLossFormatted}
</td>
</tr>\`;
    }

    return \`
<!-- PLATFORM -->
<table bgcolor="#fbfdff" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#fbfdff;border:1px solid #dbe7f6;">
<tr>
<td>
<!-- PLATFORM TITLE -->
<table bgcolor="#dbeafe" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#dbeafe;border-bottom:1px solid #c7ddfe;">
<tr>
<td class="platform-title" style="padding:6px 10px;font-family:Arial,sans-serif;color:#1d4ed8;font-size:10px;line-height:13px;font-weight:700;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    \${escapeHtml(platformName)}
</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
</table>

<!-- IMPACTED SKUS -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="table-card" style="padding:0 6px;">
<table bgcolor="#ffffff" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#ffffff;border:1px solid #e5eaf3;">
<tr>
<td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td bgcolor="#f8fafc" class="section-title" style="padding:5px 8px;background-color:#f8fafc;border-bottom:1px solid #e8eef7;font-family:Arial,sans-serif;color:#64748b;font-size:8px;line-height:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;">
    Impacted SKUs
</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tbl" style="width:100%;table-layout:fixed;">
<colgroup>
<col style="width:34%;">
<col style="width:22%;">
<col style="width:22%;">
<col style="width:22%;">
</colgroup>
<tr>
<td bgcolor="#f8fbff" width="34%" style="width:34%;padding:5px 6px;background-color:#f8fbff;border-right:1px solid #e3ebf8;border-bottom:2px solid #d7e6ff;font-family:Arial,sans-serif;color:#475569;font-size:7px;line-height:9px;font-weight:700;text-transform:uppercase;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    SKU Name
</td>
<td bgcolor="#f8fbff" width="22%" style="width:22%;padding:5px 6px;background-color:#f8fbff;border-right:1px solid #e3ebf8;border-bottom:2px solid #d7e6ff;font-family:Arial,sans-serif;color:#475569;font-size:7px;line-height:9px;font-weight:700;text-transform:uppercase;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    Brand Name
</td>
<td bgcolor="#f8fbff" width="22%" style="width:22%;padding:5px 6px;background-color:#f8fbff;border-right:1px solid #e3ebf8;border-bottom:2px solid #d7e6ff;font-family:Arial,sans-serif;color:#475569;font-size:7px;line-height:9px;font-weight:700;text-transform:uppercase;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    Current OSA
</td>
<td bgcolor="#f8fbff" width="22%" style="width:22%;padding:5px 6px;background-color:#f8fbff;border-bottom:2px solid #d7e6ff;font-family:Arial,sans-serif;color:#475569;font-size:7px;line-height:9px;font-weight:700;text-transform:uppercase;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    Sales Loss
</td>
</tr>
\${skuRows}
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
</table>
</td>
</tr>
</table>
\`;
};

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
    const headerDeltaText = deltaHtml(aggregateOsa.delta, false);

    let platformSectionsHtml = '';
    for (const pd of platformData) {
        platformSectionsHtml += buildPlatformSection(pd.platform, pd.skus);
    }

    if (!platformSectionsHtml) {
        platformSectionsHtml = \`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#fbfdff;border:1px solid #dbe7f6;">
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#dbeafe;border-bottom:1px solid #c7ddfe;">
<tr><td class="platform-title" style="padding:6px 10px;font-family:Arial,sans-serif;color:#1d4ed8;font-size:10px;line-height:13px;font-weight:700;">All Platforms</td></tr>
</table>
<div style="padding:18px;text-align:center;color:#94a3b8;font-family:Arial,sans-serif;font-size:11px;">No platform-specific data available for this alert.</div>
</td></tr>
</table>\`;
    }

    const logoHtml = logoUrl
        ? \`<img src="\${escapeHtml(logoUrl)}" alt="\${escapeHtml(companyName)} Logo" width="110" class="logo" style="width:110px;max-width:110px;height:auto;display:block;border:0;outline:none;text-decoration:none;">\`
        : \`<div style="font-family:Arial,sans-serif;font-size:18px;font-weight:800;color:#1e5eff;">\${escapeHtml(companyName)}</div>\`;
`;

// Helper to safely format a string with template literals
const processTemplateStr = (str) => {
    return str
        .replace(/`/g, '\\`') // escape backticks
        .replace(/\$\{/g, '\\$\\{') // escape literal ${ so it doesn't break our script
        .replace(/\{\{COMPANY_NAME\}\}/g, '${escapeHtml(companyName)}')
        .replace(/<img src="\{\{LOGO_URL\}\}"[^>]*>/g, '${logoHtml}')
        .replace(/\{\{TIMESTAMP\}\}/g, '${displayTime}')
        .replace(/\{\{ALERT_NAME\}\}/g, '${escapeHtml(alertName)}')
        .replace(/\{\{CURRENT_OSA\}\}/g, '${aggregateOsa.currentOsa.toFixed(1)}')
        .replace(/<span style="color:#dc2626;font-weight:700;">\{\{OSA_DELTA\}\}%<\/span>/g, '${headerDeltaText}')
        .replace(/\{\{OPERATOR\}\}\{\{THRESHOLD\}\}/g, '${escapeHtml(conditionalOperator)}${thresholdValue}')
        .replace(/\{\{SEVERITY\}\}/g, '${severity.label}')
        // The severity badge color needs to match severity.bg, border, color.
        // Wait! In sales_enablement.html, we fixed it to use #fff1f2 and #fecaca and #dc2626.
        // Let's replace those hardcoded colors with the dynamic ones.
        .replace(/bgcolor="#fff1f2"/g, 'bgcolor="${severity.bg}"')
        .replace(/background-color:#fff1f2;/g, 'background-color:${severity.bg};')
        .replace(/border:1px solid #fecaca;/g, 'border:1px solid ${severity.border};')
        .replace(/color:#dc2626;/g, 'color:${severity.color};')
        .replace(/Immediate attention required/g, '${severity.desc}')
        ;
}

jsContent += '\n    return `\n' + processTemplateStr(beforePlatform) + '\n${platformSectionsHtml}\n' + processTemplateStr(afterPlatform) + '\n`;\n};\n';

fs.writeFileSync('backend/src/utils/alertEmailTemplate.js', jsContent);
