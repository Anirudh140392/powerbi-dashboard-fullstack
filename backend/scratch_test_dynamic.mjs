import { generateDynamicAlertEmailHtml } from './src/utils/dynamicAlertEmailTemplate.js';

try {
    const html = generateDynamicAlertEmailHtml({
        logoUrl: 'http://example.com/logo.png',
        companyName: 'Test Company',
        istNow: '14 Aug 2026',
        alertName: 'Test Alert',
        severityLevel: 'High',
        currentMetricValue: '95%',
        metricDelta: '-5',
        operator: '<',
        threshold: '90',
        platformData: [
            {
                platformName: 'Amazon',
                tables: [
                    {
                        tableName: 'Impacted Brands',
                        headers: ['Brand', 'Current OSA'],
                        rows: [['Brand A', '85%']]
                    }
                ]
            }
        ]
    });
    console.log("SUCCESS, HTML Length:", html.length);
} catch (e) {
    console.error("ERROR:", e);
}
