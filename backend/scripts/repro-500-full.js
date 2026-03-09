import availabilityService from '../src/services/availabilityService.js';

const parseFilter = (val) => {
    if (!val || val === 'All' || val === 'all' || val === 'undefined') return 'All';
    if (Array.isArray(val)) return val.length > 0 ? val : 'All';
    if (typeof val === 'string' && val.includes(',')) {
        return val.split(',').map(v => v.trim()).filter(v => v !== '');
    }
    return val;
};

async function test() {
    try {
        const query = {
            platform: 'All',
            brand: 'All',
            location: 'All',
            startDate: '2026-03-01',
            endDate: '2026-03-04'
        };

        const filters = {
            platform: parseFilter(query.platform),
            brand: parseFilter(query.brand),
            location: parseFilter(query.location),
            startDate: query.startDate,
            endDate: query.endDate,
            dates: parseFilter(query.dates),
            months: parseFilter(query.months),
            cities: parseFilter(query.cities),
            categories: parseFilter(query.categories),
            formats: parseFilter(query.formats),
            category: parseFilter(query.category),
            format: parseFilter(query.format),
            zones: parseFilter(query.zones),
            metroFlags: parseFilter(query.metroFlags),
            pincodes: parseFilter(query.pincodes),
            channel: query.channel,
            compareStartDate: query.compareStartDate,
            compareEndDate: query.compareEndDate
        };

        console.log("Filters after parseFilter:", JSON.stringify(filters, null, 2));
        const data = await availabilityService.getAbsoluteOsaPercentageDetail(filters);
        console.log("Success! Data length:", data.length);
        process.exit(0);
    } catch (error) {
        console.error("CRASHED:", error);
        process.exit(1);
    }
}

test();
