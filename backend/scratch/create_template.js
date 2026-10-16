import fs from 'fs';
import path from 'path';

const htmlPath = path.join(process.cwd(), 'src', 'dynamic_alert.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const jsContent = `// src/utils/dynamicAlertEmailTemplate.js
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
        platformData = [], // Array of { platformName, headers: [c1, c2, c3, c4, c5], rows: [[v1,v2,v3,v4,v5], ...] }
    } = data;

    // We read the HTML template
    const templatePath = path.join(__dirname, '..', 'dynamic_alert.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace basic placeholders
    template = template.replace(/\\{\\{COMPANY_NAME\\}\\}/g, escapeHtml(companyName));
    
    const logoHtml = logoUrl ? escapeHtml(logoUrl) : '';
    template = template.replace(/\\{\\{LOGO_URL\\}\\}/g, logoHtml);
    
    template = template.replace(/\\{\\{TIMESTAMP\\}\\}/g, escapeHtml(istNow));
    template = template.replace(/\\{\\{ALERT_NAME\\}\\}/g, escapeHtml(alertName));
    template = template.replace(/\\{\\{CURRENT_METRIC_VALUE\\}\\}/g, escapeHtml(currentMetricValue));
    template = template.replace(/\\{\\{METRIC_DELTA\\}\\}/g, escapeHtml(metricDelta));
    template = template.replace(/\\{\\{OPERATOR\\}\\}/g, escapeHtml(operator));
    template = template.replace(/\\{\\{THRESHOLD\\}\\}/g, escapeHtml(threshold));
    template = template.replace(/\\{\\{SEVERITY\\}\\}/g, escapeHtml(severityLevel));

    // Extract platform section template
    const platformSectionMatch = template.match(/<!-- \\{\\{PLATFORM_SECTIONS_START\\}\\} -->([\\s\\S]*?)<!-- \\{\\{PLATFORM_SECTIONS_END\\}\\} -->/);
    if (!platformSectionMatch) {
        return template; // Fallback if tags missing
    }
    
    const platformSectionTemplate = platformSectionMatch[1];
    
    // Extract row template
    const rowMatch = platformSectionTemplate.match(/<!-- \\{\\{DYNAMIC_ROWS_START\\}\\} -->([\\s\\S]*?)<!-- \\{\\{DYNAMIC_ROWS_END\\}\\} -->/);
    const rowTemplate = rowMatch ? rowMatch[1] : '';

    let finalPlatformsHtml = '';

    for (const pData of platformData) {
        let pSection = platformSectionTemplate.replace(/\\{\\{PLATFORM_NAME\\}\\}/g, escapeHtml(pData.platformName || 'All Platforms'));
        
        // Headers
        for (let i = 0; i < 5; i++) {
            pSection = pSection.replace(new RegExp(\`\\\\{\\\\{COL_\${i+1}_NAME\\\\}\\\\}\`, 'g'), escapeHtml(pData.headers[i] || ''));
        }

        // Rows
        let finalRowsHtml = '';
        if (pData.rows && pData.rows.length > 0) {
            for (const rData of pData.rows) {
                let rHtml = rowTemplate;
                for (let i = 0; i < 5; i++) {
                    rHtml = rHtml.replace(new RegExp(\`\\\\{\\\\{COL_\${i+1}_VAL\\\\}\\\\}\`, 'g'), escapeHtml(rData[i] || ''));
                }
                finalRowsHtml += rHtml;
            }
        } else {
            finalRowsHtml = '<tr><td colspan="5" style="text-align:center;padding:10px;font-size:10px;">No data available</td></tr>';
        }

        if (rowMatch) {
            pSection = pSection.replace(rowMatch[0], finalRowsHtml);
        }

        finalPlatformsHtml += pSection;
    }

    template = template.replace(platformSectionMatch[0], finalPlatformsHtml);

    return template;
};
\`;

fs.writeFileSync(path.join(process.cwd(), 'src', 'utils', 'dynamicAlertEmailTemplate.js'), jsContent);
console.log('Created dynamicAlertEmailTemplate.js');
