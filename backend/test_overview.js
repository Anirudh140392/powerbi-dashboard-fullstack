import watchTowerService from './src/services/watchTowerService.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log("Testing Overview Metrics with Ecommerce:");
    let res = await watchTowerService.getOverview({
        channel: 'Ecommerce',
        startDate: '2026-03-20',
        endDate: '2026-04-20',
        platform: '' // empty platform to check channel
    });
    let inorg = res.topMetrics?.find(m => m.id === 'inorganic_sales');
    console.log("Ecommerce Inorg:", inorg ? inorg.value : 'missing', "Conversion:", res.topMetrics?.find(m => m.id === 'conversion')?.value);

    console.log("Testing Overview Metrics with QuickComm:");
    res = await watchTowerService.getOverview({
        channel: 'QuickComm',
        startDate: '2026-03-20',
        endDate: '2026-04-20'
    });
    inorg = res.topMetrics?.find(m => m.id === 'inorganic_sales');
    console.log("QuickComm Inorg:", inorg ? inorg.value : 'missing', "Conversion:", res.topMetrics?.find(m => m.id === 'conversion')?.value);
}
test().catch(console.error).finally(() => process.exit(0));
