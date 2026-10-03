import 'dotenv/config';
process.env.CLICKHOUSE_DB = 'zydus';
import watchTowerService from './src/services/watchTowerService.js';

async function run() {
    const filters = {
        keyword: ['All'],
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        compareStartDate: '2026-02-01',
        compareEndDate: '2026-02-28'
    };
    
    try {
        console.log("Running getCategoryOverview for Zydus...");
        const data = await watchTowerService.getCategoryOverview(filters);
        console.log("Success:", data.length, "categories found");
        if (data.length > 0) {
            console.log("First category sample:", JSON.stringify(data[0], null, 2));
        }
    } catch (e) {
        console.error("Error caught in debug script:", e.message);
        console.error("Stack:", e.stack);
    }
}
run();
