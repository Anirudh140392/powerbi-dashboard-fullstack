
import watchTowerService from './src/services/watchTowerService.js';
const { 
    getPerformanceBreakdownData, 
    getCategoryOverview, 
    getPlatformOverview 
} = watchTowerService;

async function test() {
    console.log("--- Testing Performance Breakdown ---");
    try {
        const filters = {
            platform_uuid: 'All',
            start_date: '2026-03-01',
            end_date: '2026-03-11',
            group_by: 'category',
            compare_periods: 'last_week,mtd,last_3_months'
        };
        const result = await getPerformanceBreakdownData(filters);
        console.log("Success!");
    } catch (e) {
        console.error("FAILED Performance Breakdown:", e.message);
    }

    console.log("\n--- Testing Category Overview ---");
    try {
        const filters = {
            keyword: 'All',
            startDate: '2026-03-01',
            endDate: '2026-03-11',
            compareStartDate: '2026-02-01',
            compareEndDate: '2026-02-28'
        };
        const result = await getCategoryOverview(filters);
        console.log("Success!");
    } catch (e) {
        console.error("FAILED Category Overview:", e.message);
    }

    console.log("\n--- Testing Platform Overview ---");
    try {
        const filters = {
            startDate: '2026-03-01',
            endDate: '2026-03-11',
            compareStartDate: '2026-02-01',
            compareEndDate: '2026-02-28',
            filterLogic: 'OR'
        };
        const result = await getPlatformOverview(filters);
        console.log("Success!");
    } catch (e) {
        console.error("FAILED Platform Overview:", e.message);
    }
}

test();
