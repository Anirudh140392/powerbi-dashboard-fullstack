import availabilityService from './services/availabilityService.js';
import { dbStorage } from './config/clickhouse.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

async function run() {
    dbStorage.run({ dbName: 'drl' }, async () => {
        try {
            console.log('Testing with startDate="2026-06-01" and endDate="2026-06-19"...');
            const filters = {
                platform: 'amazon',
                brand: 'All',
                location: 'All',
                category: 'All',
                sku: 'All',
                ownBrandsOnly: 'true',
                startDate: '2026-06-01',
                endDate: '2026-06-19',
                timeStep: 'Daily'
            };
            const res = await availabilityService.getAvailabilityKpiTrends(filters);
            console.log('Returned timeSeries length:', res.timeSeries?.length);
            console.log('All returned timeSeries:', JSON.stringify(res.timeSeries, null, 2));

        } catch (e) {
            console.error(e);
        }
    });
}
run();

