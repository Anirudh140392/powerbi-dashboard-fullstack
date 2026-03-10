
import 'dotenv/config';
import watchTowerService from './backend/src/services/watchTowerService.js';

async function test() {
    try {
        const filters = {
            platform_uuid: 'Blinkit',
            group_by: 'category',
            compare_periods: 'last_week,mtd,last_3_months'
        };
        console.log('Testing getPerformanceBreakdownData with filters:', filters);
        const result = await watchTowerService.getPerformanceBreakdownData(filters);
        console.log('Result success:', result.success);
        console.log('Result keys:', Object.keys(result));
    } catch (error) {
        console.error('Error in test:', error);
    }
}

test();
