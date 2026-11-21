import { getCorrelationsTrend } from './src/services/insightsService.js';
import dayjs from 'dayjs';

async function testTrend() {
    try {
        console.log('Testing getCorrelationsTrend service locally...');
        const filters = {
            platform: 'Blinkit',
            category: 'GMFC',
            brand: 'Orbit',
            sku: 'Orbit Mixed Fruit Bottle 22g',
            location: 'Mumbai',
            startDate: '2026-05-01',
            endDate: '2026-05-20'
        };

        console.log('Filters:', filters);
        const data = await getCorrelationsTrend(filters);
        console.log('Returned data points count:', data.length);
        if (data.length > 0) {
            console.log('Sample trend point:', data[0]);
            console.log('Keys in data point:', Object.keys(data[0]));
        } else {
            console.log('No trend data returned, trying a wider query...');
            const wideData = await getCorrelationsTrend({
                startDate: '2026-04-01',
                endDate: '2026-05-28'
            });
            console.log('Wide trend data points count:', wideData.length);
            if (wideData.length > 0) {
                console.log('Sample wide trend point:', wideData[0]);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

testTrend();
