import watchTowerService from './src/services/watchTowerService.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log("Testing Performance Metrics with Ecommerce:");
    let res = await watchTowerService.getPerformanceMetrics({
        channel: 'Ecommerce',
        startDate: '2026-03-20',
        endDate: '2026-04-20'
    });
    // Find the total impressions metric to see if it dropped to 0
    let imp = res.performanceMetricsKpis?.find(m => m.id === 'impressions');
    console.log("Ecommerce Imp:", imp ? imp.value : 'missing');

    console.log("Testing Performance Metrics with QuickComm:");
    res = await watchTowerService.getPerformanceMetrics({
        channel: 'QuickComm',
        startDate: '2026-03-20',
        endDate: '2026-04-20'
    });
    imp = res.performanceMetricsKpis?.find(m => m.id === 'impressions');
    console.log("QuickComm Imp:", imp ? imp.value : 'missing');
}
test().catch(console.error).finally(() => process.exit(0));
