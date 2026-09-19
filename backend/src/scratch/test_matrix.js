import 'dotenv/config';
import availabilityService from '../services/availabilityService.js';

async function test() {
    try {
        console.log("Running platform-kpi-matrix test...");
        const res = await availabilityService.getAbsoluteOsaPlatformKpiMatrix({
            viewMode: 'Platform',
            startDate: '2026-06-01',
            endDate: '2026-06-10',
            platform: 'blinkit',
            includeBreakdown: true,
            drillDimension: 'region',
            ownBrandsOnly: 'true'
        });
        console.log("Result success! Column values count:", res.columns.length);
    } catch (err) {
        console.error("Caught expected/unexpected error:", err);
    }
}

test();
