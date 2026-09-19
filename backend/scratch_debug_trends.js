import availabilityService from './src/services/availabilityService.js';
import { dbStorage } from './src/config/clickhouse.js';

async function run() {
    dbStorage.run({ dbName: 'drl' }, async () => {
        try {
            console.log('--- Calling getAvailabilityKpiTrends ---');
            const result = await availabilityService.getAvailabilityKpiTrends({
                platform: 'amazon',
                period: '1M',
                timeStep: 'Daily',
                dimension: 'platform',
                ownBrandsOnly: 'true',
                resellerName: 'buy more'
            });
            console.log('Result date range:', result.dateRange);
            const nonZeroDoi = result.timeSeries.filter(t => t.Doi > 0);
            console.log('Non-zero DOI points:', nonZeroDoi.length, '/', result.timeSeries.length);
            nonZeroDoi.forEach(t => console.log(`  ${t.date} -> Doi: ${t.Doi}`));
        } catch (e) {
            console.error('Error calling getAvailabilityKpiTrends:', e);
        }
    });
}
run();

