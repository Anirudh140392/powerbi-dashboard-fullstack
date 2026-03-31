import 'dotenv/config';
import wt from './src/services/watchTowerService.js';

async function test1() {
    console.log('Testing getTrendsFilterOptions (categories) with platform: ["Blinkit", "Zepto"]');
    try {
        const res1 = await wt.getTrendsFilterOptions({
            filterType: 'categories',
            platform: ['Blinkit', 'Zepto']
        });
        console.log('RESULT:', res1.options);
    } catch (err) {
        console.error('ERROR:', err);
    }
}

test1();
