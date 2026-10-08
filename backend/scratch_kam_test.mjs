import { generateDynamicAlertEmailHtml } from './src/utils/dynamicAlertEmailTemplate.js';

try {
    const platformData = [
        {
            platform: 'Amazon',
            brands: [{ brand: 'Brand A', currentOsa: 85 }],
            skus: [{ sku_name: 'SKU 1', brand: 'Brand A', currentOsa: 80 }]
        }
    ];

    const finalDynamicEmailData = platformData.map(p => {
        const tables = [];
        if (p.brands && p.brands.length > 0) {
            tables.push({
                tableName: 'Impacted Brands',
                headers: ['Brand', 'Current OSA'],
                rows: p.brands.map(b => [b.brand || 'Unknown', `${b.currentOsa}%`])
            });
        }
        if (p.skus && p.skus.length > 0) {
            tables.push({
                tableName: 'Impacted SKUs',
                headers: ['SKU', 'Brand', 'Current OSA'],
                rows: p.skus.map(s => [s.sku_name || s.sku || 'Unknown', s.brand || 'Unknown', `${s.currentOsa}%`])
            });
        }
        return {
            platformName: p.platform,
            tables
        };
    });

    const aggregateOsa = { currentOsa: 82.5, delta: -2.5 };
    const alert = { alert_name: 'Test Alert', severity_level: 'High' };

    const emailHtml = generateDynamicAlertEmailHtml({
        logoUrl: 'logo.png',
        companyName: 'Company',
        istNow: '14 Aug',
        alertName: alert.alert_name || 'Low OSA Alert',
        severityLevel: alert.severity_level || 'Warning',
        currentMetricValue: aggregateOsa.currentOsa ? `${aggregateOsa.currentOsa}%` : 'N/A',
        metricDelta: aggregateOsa.delta,
        operator: '<',
        threshold: 90,
        platformData: finalDynamicEmailData,
    });
    console.log("Success! HTML Length:", emailHtml.length);
} catch (e) {
    console.error("Crash:", e);
}
