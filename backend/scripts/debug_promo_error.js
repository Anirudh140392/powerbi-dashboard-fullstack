import watchTowerService from './src/services/watchTowerService.js';

async function test() {
    try {
        console.log('Calling getSummaryMetrics...');
        const data = await watchTowerService.getSummaryMetrics({ months: 1 });
        console.log('SUCCESS! topMetrics count:', data.topMetrics?.length);
        console.log('Metric names:', data.topMetrics?.map(m => m.name));
        console.log('summaryMetrics has promo:', 'promo' in (data.summaryMetrics || {}));
    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
    process.exit(0);
}

test();
