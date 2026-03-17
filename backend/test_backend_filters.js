
import availabilityService from './src/services/availabilityService.js';
import { setCurrentDbName } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testBackend() {
    try {
        console.log('--- Testing Backend with User Filters ---');
        
        // Mock the logic that would be in the middleware/auth
        // We are on 'mars' database as per .env
        // Note: setCurrentDbName doesn't work well without the AsyncLocalStorage context, 
        // but the config usually defaults to what is in .env if not set.
        
        const userFilters = {
            platform: 'Blinkit',
            category: 'GMFC',
            productCategory: 'Gold',
            startDate: '2026-03-01',
            endDate: '2026-03-11'
        };

        console.log('Running getDOI...');
        const doiResult = await availabilityService.getDOI(userFilters);
        console.log('DOI Result:', JSON.stringify(doiResult, null, 2));

        console.log('\nRunning getAbsoluteOsaOverview...');
        const osaResult = await availabilityService.getAbsoluteOsaOverview(userFilters);
        console.log('OSA Result:', JSON.stringify(osaResult, null, 2));

        // Let's try Instamart which we know has data
        const instamartFilters = {
            ...userFilters,
            platform: 'Instamart'
        };
        console.log('\nRunning getDOI for Instamart...');
        const doiInsta = await availabilityService.getDOI(instamartFilters);
        console.log('DOI Instamart:', doiInsta.doi);

    } catch (err) {
        console.error('Test Failed:', err);
    }
}

testBackend();
