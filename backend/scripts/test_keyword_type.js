import dotenv from 'dotenv';
dotenv.config();

import performanceMarketingService from '../src/services/performanceMarketingService.js';

async function test() {
    try {
        const filters = {
            platform: 'All',
            brand: 'All',
            zone: 'All',
            startDate: '2026-03-01',
            endDate: '2026-03-07'
        };
        const data = await performanceMarketingService.getKeywordTypePerformance(filters);
        console.log("Success");
    } catch (e) {
        console.error("Error occurred:");
        console.error(e.stack);
    }
    process.exit(0);
}

test();
