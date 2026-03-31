
import visibilityService from './src/services/visibilityService.js';

async function testDates() {
    try {
        console.log('--- Testing getLatestAvailableDates ---');
        const res = await visibilityService.getLatestAvailableDates();
        console.log('Result:', JSON.stringify(res, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

testDates();
