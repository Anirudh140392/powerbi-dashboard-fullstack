import { generateDynamicAlertEmailHtml } from '../src/utils/dynamicAlertEmailTemplate.js';

const mockData = {
    companyName: 'TestCo',
    alertName: 'Keyword Delta SOS',
    platformData: [
        {
            platformName: 'Blinkit',
            tables: [
                {
                    tableName: 'Branded',
                    headers: ['Keyword', 'CW SOS %', 'L4W Avg %', 'Delta'],
                    rows: [['k1', '50%', '40%', '10%']]
                }
            ]
        }
    ]
};

try {
    const html = generateDynamicAlertEmailHtml(mockData);
    console.log("SUCCESS. Length:", html.length);
} catch (e) {
    console.error("ERROR:", e);
}
