import watchTowerService from './src/services/watchTowerService.js';
import dayjs from 'dayjs';

async function test() {
    try {
        console.log('Testing Promo KPI in getSummaryMetrics...');
        const filters = { months: 1 };
        const data = await watchTowerService.getSummaryMetrics(filters);

        console.log('Top Metrics Count:', data.topMetrics.length);
        console.log('Metrics names:', data.topMetrics.map(m => m.name));

        const promo = data.topMetrics.find(m => m.name === 'Promo');
        if (promo) {
            console.log('✅ Promo KPI found!');
            console.log('Promo Label:', promo.label);
            console.log('Promo Trend:', promo.trend);
        } else {
            console.log('❌ Promo KPI NOT found in topMetrics');
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
    process.exit();
}

test();
