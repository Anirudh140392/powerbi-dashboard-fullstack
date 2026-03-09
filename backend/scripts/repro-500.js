import availabilityService from '../src/services/availabilityService.js';

async function test() {
    try {
        const filters = {
            platform: 'All',
            brand: 'All',
            location: 'All',
            startDate: '2026-03-01',
            endDate: '2026-03-04'
        };
        console.log("Calling getAbsoluteOsaPercentageDetail with:", filters);
        const result = await availabilityService.getAbsoluteOsaPercentageDetail(filters);
        console.log("Result length:", result.length);
        process.exit(0);
    } catch (e) {
        console.error("FAILED with error:", e);
        process.exit(1);
    }
}

test();
