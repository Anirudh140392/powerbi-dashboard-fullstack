import dotenv from 'dotenv';
dotenv.config();

import watchTowerService from '../src/services/watchTowerService.js';

async function test() {
    try {
        const filters = {
            startDate: '2026-03-01',
            endDate: '2026-03-05',
            compareStartDate: '2026-02-01',
            compareEndDate: '2026-02-28',
            channel: 'QuickComm',
            filterLogic: 'OR'
        };
        const data = await watchTowerService.getPlatformOverview(filters);
        console.log("Success");
    } catch (e) {
        console.error("Error occurred:");
        console.error(e.stack);
    }
    process.exit(0);
}

test();
