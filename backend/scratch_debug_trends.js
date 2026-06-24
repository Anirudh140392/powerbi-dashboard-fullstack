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
            console.log('TimeSeries (first 10):');
            console.log(result.timeSeries.slice(0, 10));
        } catch (e) {
            console.error('Error calling getAvailabilityKpiTrends:', e);
        }
    });
}
run();
