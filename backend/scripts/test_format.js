import dotenv from 'dotenv';
dotenv.config();

import performanceMarketingService from './src/services/performanceMarketingService.js';

async function testFormat() {
    try {
        const filters = {
            platform: 'All',
            brand: 'All',
            zone: 'All',
            startDate: '2026-03-01',
            endDate: '2026-03-07'
        };
        console.log("Testing getFormatPerformance...");
        const data = await performanceMarketingService.getFormatPerformance(filters);
        console.log("Success getFormatPerformance");
    } catch (e) {
        console.error("Error in getFormatPerformance:");
        console.error(e.stack);
    }
    process.exit(0);
}

testFormat();
