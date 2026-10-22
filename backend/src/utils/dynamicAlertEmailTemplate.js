// src/utils/dynamicAlertEmailTemplate.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escapeHtml = (str) => {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

const toPascalCase = (str) => {
    if (str === null || str === undefined) return '';
    const s = String(str);
    // If it's a number with an optional % sign, return as is
    if (/^[0-9.-]+%?$/.test(s.trim())) {
        return s;
    }
    return s.split(/\s+/).map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
};

const buildSubTable = (headers, rows, tableName) => {
    const colCount = headers.length;
    const colWidth = Math.floor(100 / colCount) + '%';
    
    let tableHtml = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="table-card" style="padding:0 6px;">

<table bgcolor="#ffffff" role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="width:100%;background-color:#ffffff;
              border:1px solid #e5eaf3;">
<tr>
<td>

<table role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0">
<tr>
<td bgcolor="#f8fafc" class="section-title"
    style="padding:5px 8px;background-color:#f8fafc;
           border-bottom:1px solid #e8eef7;
           font-family:Arial,sans-serif;color:#64748b;font-size:8px;
           line-height:10px;font-weight:700;text-transform:uppercase;
           letter-spacing:.3px;">
    ${escapeHtml(toPascalCase(tableName || 'Impacted Items'))}
</td>
</tr>
</table>

<table role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       class="tbl"
       style="width:100%;table-layout:fixed;">
<colgroup>
`;
    for(let i=0; i<colCount; i++){
        tableHtml += `<col style="width:${colWidth};">\n`;
    }
    tableHtml += `</colgroup>\n<tr>\n`;
    
    // Headers
    for(let i=0; i<colCount; i++){
        let borderBottom = '2px solid #d7e6ff';
        let borderRight = (i < colCount - 1) ? '1px solid #e3ebf8' : 'none';
        tableHtml += `<td bgcolor="#f8fbff" width="${colWidth}"
    style="width:${colWidth};padding:5px 6px;background-color:#f8fbff;
           border-right:${borderRight};border-bottom:${borderBottom};
           font-family:Arial,sans-serif;color:#475569;font-size:7px;
           line-height:9px;font-weight:700;text-transform:uppercase;
           word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;">
    ${escapeHtml(toPascalCase(headers[i]))}
</td>\n`;
    }
    tableHtml += `</tr>\n`;
    
    // Rows
    if (rows && rows.length > 0) {
        for(let r=0; r<rows.length; r++){
            tableHtml += `<tr>\n`;
            for(let i=0; i<colCount; i++){
                let borderRight = (i < colCount - 1) ? '1px solid #e3ebf8' : 'none';
                let borderBottom = (r < rows.length - 1) ? '1px solid #f3f4f6' : 'none';
                tableHtml += `<td style="padding:5px 6px;border-right:${borderRight};
           border-bottom:${borderBottom};
           font-family:Arial,sans-serif;color:#111827;font-size:9px;
           line-height:12px;word-break:break-word;word-wrap:break-word;
           overflow-wrap:break-word;">
    ${escapeHtml(toPascalCase(rows[r][i]))}
</td>\n`;
            }
            tableHtml += `</tr>\n`;
        }
    } else {
        tableHtml += `<tr><td colspan="${colCount}" style="text-align:center;padding:10px;font-size:10px;">No data available</td></tr>\n`;
    }
    
    tableHtml += `
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
`;
    return tableHtml;
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

export const generateDynamicAlertEmailHtml = (data) => {
    const {
        logoUrl = '',
        companyName = 'Company',
        istNow = '',
        alertName = 'Alert',
        severityLevel = 'Warning',
        currentMetricValue = '',
        metricDelta = '',
        operator = '<',
        threshold = '',
        platformData = [], // Array of { platformName, tables: [{ tableName, headers, rows }] } or { platformName, headers, rows }
        cwStart = '',
        cwEnd = '',
        l4wStart = '',
        l4wEnd = '',
        isDynamicAlert = false,
    } = data;

    // We read the HTML template
    const templatePath = path.join(__dirname, '..', 'dynamic_alert.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace basic placeholders
    template = template.replace(/\{\{COMPANY_NAME\}\}/g, escapeHtml(companyName));
    
    const logoHtml = logoUrl ? escapeHtml(logoUrl) : '';
    template = template.replace(/\{\{LOGO_URL\}\}/g, logoHtml);
    
    template = template.replace(/\{\{TIMESTAMP\}\}/g, escapeHtml(istNow));

    let dateRangeHtml = '';
    if (cwStart && cwEnd && l4wStart && l4wEnd) {
        const currentDisplay = `${formatDateDisplay(cwStart)} – ${formatDateDisplay(cwEnd)}`;
        const previousDisplay = `${formatDateDisplay(l4wStart)} – ${formatDateDisplay(l4wEnd)}`;
        
        let labelHtml = `Snapshot &middot; Current (${currentDisplay}) vs Previous (${previousDisplay})`;
        if (isDynamicAlert) {
            labelHtml = `Weekly snapshot &middot; CW as of ${currentDisplay} vs L4W Avg (${previousDisplay})`;
        }

        dateRangeHtml = `<div style="font-family:Arial,sans-serif;color:#667085;font-size:11px;padding-top:4px;">
    ${labelHtml}
</div>`;
    }
    template = template.replace(/\{\{DATE_RANGE_HTML\}\}/g, dateRangeHtml);

    template = template.replace(/\{\{ALERT_NAME\}\}/g, escapeHtml(alertName));
    template = template.replace(/\{\{CURRENT_METRIC_VALUE\}\}/g, escapeHtml(currentMetricValue));
    template = template.replace(/\{\{METRIC_DELTA\}\}/g, escapeHtml(metricDelta));
    template = template.replace(/\{\{OPERATOR\}\}/g, escapeHtml(operator));
    template = template.replace(/\{\{THRESHOLD\}\}/g, escapeHtml(threshold));
    template = template.replace(/\{\{SEVERITY\}\}/g, escapeHtml(severityLevel));

    // Extract platform section template
    const platformSectionMatch = template.match(/<!-- \{\{PLATFORM_SECTIONS_START\}\} -->([\s\S]*?)<!-- \{\{PLATFORM_SECTIONS_END\}\} -->/);
    if (!platformSectionMatch) {
        return template; // Fallback if tags missing
    }
    
    const platformSectionTemplate = platformSectionMatch[1];
    let finalPlatformsHtml = '';

    for (const pData of platformData) {
        let pSection = platformSectionTemplate.replace(/\{\{PLATFORM_NAME\}\}/g, () => escapeHtml(toPascalCase(pData.platformName || 'All Platforms')));
        
        let subTablesHtml = '';
        if (pData.tables && pData.tables.length > 0) {
            for (const tbl of pData.tables) {
                subTablesHtml += buildSubTable(tbl.headers, tbl.rows, tbl.tableName);
            }
        } else if (pData.headers && pData.rows) {
            subTablesHtml += buildSubTable(pData.headers, pData.rows, 'Impacted Items');
        } else {
            subTablesHtml += buildSubTable(['Item'], [], 'Impacted Items');
        }

        pSection = pSection.replace(/<!-- \{\{SUB_TABLES_HTML\}\} -->/, () => subTablesHtml);
        finalPlatformsHtml += pSection;
    }

    template = template.replace(platformSectionMatch[0], () => finalPlatformsHtml);

    return template;
};
