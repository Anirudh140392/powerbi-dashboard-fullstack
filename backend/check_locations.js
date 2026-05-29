import { visibilityService } from './src/services/visibilityService.js';
import dayjs from 'dayjs';

async function test() {
    try {
        const result = await visibilityService.getSearchTermsLocationDrilldown({
            platform: 'blinkit',
            keyword: 'mamaea',
            brand: 'mamaearth',
            viewMode: 'keyword',
            startDate: '2026-05-01',
            endDate: '2026-05-25',
            rank: '10' // or whatever
        });
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
}
test();
