import VisibilityService from './src/services/visibilityService.js';
import dayjs from 'dayjs';

async function testSOS() {
    const service = new VisibilityService();
    const filters = {
        startDate: '2026-03-01',
        endDate: '2026-03-07',
        platform: 'Blinkit'
    };

    console.log('Testing Visibility Overview...');
    try {
        const overview = await service.getVisibilityOverview(filters);
        console.log('Overview Results:', JSON.stringify(overview, null, 2));
    } catch (err) {
        console.error('Overview Error:', err);
    }

    console.log('\nTesting Platform KPI Matrix...');
    try {
        const matrix = await service.getPlatformKpiMatrix(filters);
        console.log('Matrix Results Summary:', {
            platforms: matrix.platformData.columns,
            rows: matrix.platformData.rows.length
        });
    } catch (err) {
        console.error('Matrix Error:', err);
    }
}

testSOS();
