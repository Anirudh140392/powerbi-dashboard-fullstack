import { connectClickHouse } from './src/config/clickhouse.js';
import visibilityService from './src/services/visibilityService.js';

async function run() {
    await connectClickHouse();
    try {
        console.log("================= OWN BRAND (the derma co.) =================");
        const resOwn = await visibilityService.getSearchTermsPerformance({
            viewMode: 'keyword',
            brand: 'the derma co.',
            ownBrandsOnly: false,
            sku: 'All',
            startDate: '2026-06-01',
            endDate: '2026-06-30'
        });
        console.log("Own Brand keyword items count:", resOwn?.items?.length);
        if (resOwn?.items?.length > 0) {
            for (let i = 0; i < Math.min(5, resOwn.items.length); i++) {
                console.log(`Item ${i}:`, resOwn.items[i].name, "Leading Brand:", resOwn.items[i].leadingBrand, "Overall SOS:", resOwn.items[i].overallSOS, "Organic SOS:", resOwn.items[i].organicSOS, "Paid SOS:", resOwn.items[i].paidSOS);
            }
        }

        console.log("\n================= COMPETITOR BRAND (dot & key) =================");
        const resComp = await visibilityService.getSearchTermsPerformance({
            viewMode: 'keyword',
            brand: 'dot & key',
            ownBrandsOnly: false,
            sku: 'All',
            startDate: '2026-06-01',
            endDate: '2026-06-30'
        });
        console.log("Competitor Brand keyword items count:", resComp?.items?.length);
        if (resComp?.items?.length > 0) {
            for (let i = 0; i < Math.min(5, resComp.items.length); i++) {
                console.log(`Item ${i}:`, resComp.items[i].name, "Leading Brand:", resComp.items[i].leadingBrand, "Overall SOS:", resComp.items[i].overallSOS, "Organic SOS:", resComp.items[i].organicSOS, "Paid SOS:", resComp.items[i].paidSOS);
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
