import watchTowerService from './src/services/watchTowerService.js';
async function test() {
    try {
        const result = await watchTowerService.getKpiTrends({
            dimension: 'brand',
            dimensionValue: "Hershey's",
            platform: 'All',
            period: '1M',
            timeStep: 'Daily'
        });
        console.log("Success:", !!result);
    } catch(err) {
        console.error("ERROR", err);
    }
    process.exit();
}
test();
