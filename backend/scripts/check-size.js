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
        const data = await availabilityService.getAbsoluteOsaPercentageDetail(filters);
        const jsonStr = JSON.stringify(data);
        console.log("JSON length (minified):", jsonStr.length);
        const jsonPretty = JSON.stringify(data, null, 2);
        console.log("JSON length (pretty):", jsonPretty.length);
        process.exit(0);
    } catch (e) {
        process.exit(1);
    }
}

test();
