import visibilityService from './src/services/visibilityService.js';
import dayjs from 'dayjs';

async function testMatrix() {
    try {
        const filters = {
            startDate: dayjs().subtract(7, 'days').format('YYYY-MM-DD'),
            endDate: dayjs().format('YYYY-MM-DD')
        };
        console.log('Testing getPlatformKpiMatrix with filters:', filters);
        const result = await visibilityService.getPlatformKpiMatrix(filters);

        // Let's see if it returned the mock data
        if (result && result.platformData && result.platformData.rows) {
            const hasAmazon = result.platformData.rows.some(r => Object.keys(r).includes('AMAZON'));
            console.log('Returned rows:', result.platformData.rows.length);
            console.log('Contains Amazon?', hasAmazon);
            console.log('Are we returning mock data? ->', hasAmazon ? 'YES' : 'NO');
        } else {
            console.log('Invalid response structure:', result);
        }
    } catch (err) {
        console.error('Fatal Error calling getPlatformKpiMatrix:', err);
    }
    process.exit(0);
}

testMatrix();
