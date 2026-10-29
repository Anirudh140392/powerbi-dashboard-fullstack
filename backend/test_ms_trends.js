import { getMarketShareCompetitionTrends } from './src/services/marketShareHelper.js';
import dayjs from 'dayjs';

async function test() {
    try {
        const params = {
            mode: 'brand',
            targets: 'Ferrero,Cadbury,Nestle,Alpenliebe',
            platform: 'All',
            location: 'All',
            category: 'All',
            brand: 'All',
            period: '1M',
            startDate: '2026-02-10',
            endDate: '2026-03-10'
        };

        const { mode, targets, platform, location, category, period, startDate, endDate } = params;

        console.log('Testing with params:', params);
        const result = await getMarketShareCompetitionTrends(
            mode, targets, period, startDate, endDate, platform, category, location
        );
        console.log('Result dates count:', result.dates.length);
        console.log('Result dates:', result.dates);
        console.log('TimeSeriesByTarget keys:', Object.keys(result.timeSeriesByTarget));

        if (result.dates.length > 0) {
            const firstDate = result.dates[0];
            const firstTarget = Object.keys(result.timeSeriesByTarget)[0];
            console.log(`Sample data for ${firstTarget} on ${firstDate}:`, result.timeSeriesByTarget[firstTarget][firstDate]);
        }
    } catch (error) {
        console.error('Error during test:', error);
    }
}

test();
