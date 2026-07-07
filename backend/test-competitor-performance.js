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
            console.log("Own Brand sample keyword:", resOwn.items[0]);
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
            console.log("Competitor Brand sample keyword:", resComp.items[0]);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
