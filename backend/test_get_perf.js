import watchTowerService from './src/services/watchTowerService.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log("Testing with Ecommerce:");
    let res = await watchTowerService.getPerformanceBreakdownData({
        channel: 'Ecommerce',
        group_by: 'category',
        startDate: '2026-03-20',
        endDate: '2026-04-20'
    });
    console.log("Ecommerce rows:", res.data.length, "Total imps:", res.totals.impressions);

    console.log("Testing with E-Commerce:");
    res = await watchTowerService.getPerformanceBreakdownData({
        channel: 'E-Commerce',
        group_by: 'category',
        startDate: '2026-03-20',
        endDate: '2026-04-20'
    });
    console.log("E-Commerce rows:", res.data.length, "Total imps:", res.totals.impressions);
}
test().catch(console.error).finally(() => process.exit(0));
