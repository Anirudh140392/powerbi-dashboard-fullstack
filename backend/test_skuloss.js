import { getInsightsData } from './src/services/insightsService.js';

const test = async () => {
    try {
        const filters = {
            platform: 'Blinkit',
            city: 'Mumbai',
            category: 'Chocolates (Non Gifting)',
            productLine: 'All product lines',
            signal: 'Share Headroom Hotspots',
            brand: 'All',
            startDate: '2026-04-01',
            endDate: '2026-04-26',
            compareStartDate: '2026-03-07',
            compareEndDate: '2026-03-31'
        };
        const result = await getInsightsData(filters);
        const shh = result.find(r => r.type === 'Share Headroom Hotspots');
        console.log("SHH Evidence:", shh.evidence);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
};

test();
