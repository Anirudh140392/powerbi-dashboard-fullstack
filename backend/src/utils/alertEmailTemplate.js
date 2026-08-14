// src/utils/alertEmailTemplate.js
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
        return `${String(day).padStart(2,'0')} ${month} ${year} • ${timeParts[0]}:${timeParts[1]} IST`;
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
        return `<sup style="color:${color};font-size:7px;line-height:0;vertical-align:super;">${arrow} ${absVal}%</sup>`;
    }
    return `<span style="color:${color};font-weight:700;">${arrow} ${absVal}%</span>`;
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
        const salesLossFormatted = s.salesLoss ? `₹${Math.round(s.salesLoss).toLocaleString('en-IN')}` : '—';
        skuRows += `<tr>
<td style="padding:5px 6px;border-right:1px solid #e3ebf8;border-bottom:1px solid #f3f4f6;font-family:Arial,sans-serif;color:#111827;font-size:9px;line-height:12px;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(s.skuName)}
</td>
<td style="padding:5px 6px;border-right:1px solid #e3ebf8;border-bottom:1px solid #f3f4f6;font-family:Arial,sans-serif;color:#111827;font-size:9px;line-height:12px;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(s.brand)}
</td>
<td style="padding:5px 6px;border-right:1px solid #e3ebf8;border-bottom:1px solid #f3f4f6;font-family:Arial,sans-serif;color:#111827;font-size:9px;line-height:12px;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${s.currentOsa.toFixed(1)}% ${deltaHtml(s.delta, true)}
</td>
<td style="padding:5px 6px;border-bottom:1px solid #f3f4f6;font-family:Arial,sans-serif;color:#dc2626;font-size:9px;line-height:12px;font-weight:700;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${salesLossFormatted}
</td>
</tr>`;
    }

    return `
<!-- PLATFORM -->
<table bgcolor="#fbfdff" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#fbfdff;border:1px solid #dbe7f6;">
<tr>
<td>
<!-- PLATFORM TITLE -->
<table bgcolor="#dbeafe" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#dbeafe;border-bottom:1px solid #c7ddfe;">
<tr>
<td class="platform-title" style="padding:6px 10px;font-family:Arial,sans-serif;color:#1d4ed8;font-size:10px;line-height:13px;font-weight:700;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(platformName)}
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
${skuRows}
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
`;
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
        platformSectionsHtml = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#fbfdff;border:1px solid #dbe7f6;">
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#dbeafe;border-bottom:1px solid #c7ddfe;">
<tr><td class="platform-title" style="padding:6px 10px;font-family:Arial,sans-serif;color:#1d4ed8;font-size:10px;line-height:13px;font-weight:700;">All Platforms</td></tr>
</table>
<div style="padding:18px;text-align:center;color:#94a3b8;font-family:Arial,sans-serif;font-size:11px;">No platform-specific data available for this alert.</div>
</td></tr>
</table>`;
    }

    const logoHtml = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)} Logo" width="110" class="logo" style="width:110px;max-width:110px;height:auto;display:block;border:0;outline:none;text-decoration:none;">`
        : `<div style="font-family:Arial,sans-serif;font-size:18px;font-weight:800;color:#1e5eff;">${escapeHtml(companyName)}</div>`;

    return `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office">
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
html, body {
    margin:0 !important;
    padding:0 !important;
    width:100% !important;
    height:100% !important;
}
body, table, td, a {
    -webkit-text-size-adjust:100%;
    -ms-text-size-adjust:100%;
}
table, td {
    mso-table-lspace:0pt;
    mso-table-rspace:0pt;
}
table {
    border-collapse:collapse;
}
img {
    -ms-interpolation-mode:bicubic;
    border:0;
    outline:none;
    text-decoration:none;
    display:block;
}
.ExternalClass { width:100%; }
.ExternalClass, .ExternalClass p, .ExternalClass span,
.ExternalClass font, .ExternalClass td, .ExternalClass div {
    line-height:100%;
}

@media only screen and (max-width:600px) {
    .email-shell {
        width:100% !important;
    }
    .outer-pad {
        padding:10px !important;
    }
    .mobile-pad {
        padding:8px !important;
    }
    .logo {
        width:100px !important;
        max-width:100px !important;
    }
    .alert-title {
        font-size:11px !important;
    }
    .metric-box {
        padding:7px !important;
    }
    .metric-value {
        font-size:13px !important;
    }
    .platform-title {
        font-size:9px !important;
        padding:6px 8px !important;
    }
    .table-card {
        padding:5px !important;
    }
    .tbl th,
    .tbl td {
        padding:4px !important;
        font-size:7px !important;
    }
    .section-title {
        font-size:7px !important;
        padding:5px 8px !important;
    }
}
@media only screen and (max-width:380px) {
    .metric-value {
        font-size:12px !important;
    }
    .logo {
        width:100px !important;
        max-width:100px !important;
    }
}
</style>
</head>

<body bgcolor="#f4f7fb" style="margin:0;padding:0;background-color:#f4f7fb;">

<center bgcolor="#f4f7fb" style="width:100%;background-color:#f4f7fb;">

<!--[if mso]>
<table role="presentation" width="676" align="center" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding:0;">
<![endif]-->

<table role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       align="center"
       class="email-shell"
       style="width:100%;max-width:676px;">
<tr>
<td class="outer-pad" style="padding:18px;">

<!--[if !mso]><!-->
<div style="max-width:640px;margin:0 auto;">
<!--<![endif]-->

<!--[if mso]>
<table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" border="0">
<tr><td>
<![endif]-->

<!-- HEADER -->
<table bgcolor="#f8fbff" role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="width:100%;background-color:#f8fbff;border:1px solid #d7e6ff;">
<tr>
<td bgcolor="#f8fbff" class="mobile-pad"
    style="padding:10px;background-color:#f8fbff;">

<div style="font-family:Arial,sans-serif;color:#4b74c9;font-size:9px;
            line-height:12px;font-weight:700;letter-spacing:1.5px;
            text-transform:uppercase;">
    INTELLIGENT ALERTS
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding:4px 0;">
    ${logoHtml}
</td>
</tr>
</table>

<div style="font-family:Arial,sans-serif;color:#667085;font-size:11px;line-height:15px;">
    Intelligent Alert Dispatch
</div>

<div style="padding-top:4px;font-family:Arial,sans-serif;color:#667085;
            font-size:11px;line-height:15px;">
    ${displayTime}
</div>

</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:10px;line-height:10px;font-size:10px;">&nbsp;</td></tr>
</table>

<!-- MAIN CARD -->
<table bgcolor="#ffffff" role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="width:100%;background-color:#ffffff;border:1px solid #e5edf8;">
<tr>
<td class="mobile-pad" style="padding:10px;">

<!-- ALERT TITLE -->
<table role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0">
<tr>
<td valign="middle"
    style="font-family:Arial,sans-serif;color:#111827;font-size:13px;
           line-height:17px;font-weight:700;word-break:break-word;
           word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(alertName)}
</td>

<td valign="middle"
    align="right"
    style="font-family:Arial,sans-serif;color:${severity.color};font-size:9px;
           line-height:12px;font-weight:700;white-space:nowrap;">
    TRIGGERED
</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:8px;line-height:8px;font-size:8px;">&nbsp;</td></tr>
</table>

<!-- INFO / METRICS -->
<table bgcolor="#f8fbff" role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="width:100%;background-color:#f8fbff;border:1px solid #cfe0ff;">
<tr>
<td class="mobile-pad" style="padding:8px;">

<table role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0">
<tr>

<!-- METRIC 1 -->
<td class="metric-cell"
    width="33.33%"
    valign="top"
    style="width:33.33%;padding:0 6px 0 0;">

<table bgcolor="#ffffff" role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="background-color:#ffffff;border:1px solid #dde8fb;">
<tr>
<td class="metric-box"
    style="padding:8px;">

<div style="font-family:Arial,sans-serif;font-size:8px;line-height:10px;
            text-transform:uppercase;color:#64748b;font-weight:700;
            letter-spacing:.3px;">
    Current OSA
</div>

<div class="metric-value"
     style="font-family:Arial,sans-serif;font-size:15px;line-height:18px;
            font-weight:800;color:#111827;padding-top:3px;
            word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${aggregateOsa.currentOsa.toFixed(1)}%
</div>

<div style="font-family:Arial,sans-serif;font-size:8px;line-height:11px;
            color:#64748b;padding-top:4px;word-break:break-word;
            word-wrap:break-word;overflow-wrap:break-word;">
    ${headerDeltaText}
    vs previous
</div>

</td>
</tr>
</table>

</td>

<!-- DIVIDER -->
<td bgcolor="#b8d5ff" class="metric-divider"
    width="2"
    style="width:2px;background-color:#b8d5ff;font-size:0;line-height:0;">
    &nbsp;
</td>

<!-- METRIC 2 -->
<td class="metric-cell"
    width="33.33%"
    valign="top"
    style="width:33.33%;padding:0 3px;">

<table bgcolor="#ffffff" role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="background-color:#ffffff;border:1px solid #dde8fb;">
<tr>
<td class="metric-box"
    style="padding:8px;">

<div style="font-family:Arial,sans-serif;font-size:8px;line-height:10px;
            text-transform:uppercase;color:#64748b;font-weight:700;
            letter-spacing:.3px;">
    Alert Threshold
</div>

<div class="metric-value"
     style="font-family:Arial,sans-serif;font-size:15px;line-height:18px;
            font-weight:800;color:#111827;padding-top:3px;
            word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(conditionalOperator)} ${thresholdValue}%
</div>

<div style="font-family:Arial,sans-serif;font-size:8px;line-height:11px;
            color:#64748b;padding-top:4px;word-break:break-word;
            word-wrap:break-word;overflow-wrap:break-word;">
    Trigger Condition Active
</div>

</td>
</tr>
</table>

</td>

<!-- DIVIDER -->
<td bgcolor="#b8d5ff" class="metric-divider"
    width="2"
    style="width:2px;background-color:#b8d5ff;font-size:0;line-height:0;">
    &nbsp;
</td>

<!-- METRIC 3 -->
<td class="metric-cell"
    width="33.33%"
    valign="top"
    style="width:33.33%;padding:0 0 0 6px;">

<table bgcolor="#ffffff" role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="background-color:#ffffff;border:1px solid #dde8fb;">
<tr>
<td class="metric-box"
    style="padding:8px;">

<div style="font-family:Arial,sans-serif;font-size:8px;line-height:10px;
            text-transform:uppercase;color:#64748b;font-weight:700;
            letter-spacing:.3px;">
    Severity
</div>

<!-- Severity badge: table-based instead of inline-block span so
     the padding renders correctly in the Word/Outlook engine -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td bgcolor="${severity.bg}" style="padding:3px 9px;background-color:${severity.bg};border:1px solid ${severity.border};
           font-family:Arial,sans-serif;color:${severity.color};font-size:9px;
           line-height:11px;font-weight:700;white-space:nowrap;">
    ${severity.label}
</td>
</tr>
</table>

<div style="font-family:Arial,sans-serif;font-size:8px;line-height:11px;
            color:#64748b;padding-top:4px;word-break:break-word;
            word-wrap:break-word;overflow-wrap:break-word;">
    ${severity.desc}
</div>

</td>
</tr>
</table>

</td>
</tr>
</table>

</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:10px;line-height:10px;font-size:10px;">&nbsp;</td></tr>
</table>


${platformSectionsHtml}


<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:10px;line-height:10px;font-size:10px;">&nbsp;</td></tr>
</table>

<!-- DELIVERY SUMMARY -->
<table bgcolor="#ffffff" role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="width:100%;background-color:#ffffff;border:1px solid #d7e6ff;">
<tr>
<td style="padding:6px;font-family:Arial,sans-serif;color:#111827;
           font-size:10px;line-height:14px;word-break:break-word;
           word-wrap:break-word;overflow-wrap:break-word;">

<div style="font-family:Arial,sans-serif;color:#1e5eff;font-size:8px;
            line-height:10px;font-weight:700;text-transform:uppercase;
            letter-spacing:.3px;padding-bottom:3px;">
    Delivery Summary
</div>

Alert dispatched successfully for
<b>${escapeHtml(companyName)}</b>
with
<b>${severity.label}</b>
severity.

</td>
</tr>
</table>

</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:8px;line-height:8px;font-size:8px;">&nbsp;</td></tr>
</table>

<!-- FOOTER -->
<table role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0">
<tr>
<td align="center"
    style="font-family:Arial,sans-serif;color:#64748b;font-size:8px;
           line-height:11px;">
    Automated alert generated by Trailytics
</td>
</tr>
</table>

<!--[if mso]>
</td>
</tr>
</table>
<![endif]-->

<!--[if !mso]><!-->
</div>
<!--<![endif]-->

</td>
</tr>
</table>

<!--[if mso]>
</td>
</tr>
</table>
<![endif]-->

</center>
</body>
</html>
`;
};
