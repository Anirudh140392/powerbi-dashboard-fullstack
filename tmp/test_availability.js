import availabilityService from '../backend/src/services/availabilityService.js';
import { queryClickHouse } from '../backend/src/config/clickhouse.js';

async function test() {
    try {
        console.log('--- Testing getAbsoluteOsaPlatformKpiMatrix (Platform) ---');
        const platformData = await availabilityService.getAbsoluteOsaPlatformKpiMatrix({
            viewMode: 'Platform',
            startDate: '2024-03-01',
            endDate: '2024-03-10',
            location: 'All India',
            platform: 'All',
            brand: 'All'
        });
        console.log('Platform Columns:', platformData.columns);

        console.log('\n--- Testing getAbsoluteOsaPlatformKpiMatrix (Format) ---');
        const formatData = await availabilityService.getAbsoluteOsaPlatformKpiMatrix({
            viewMode: 'Format',
            startDate: '2024-03-01',
            endDate: '2024-03-10',
            location: 'All India',
            platform: 'All',
            brand: 'All'
        });
        console.log('Format Columns:', formatData.columns);
        console.log('Format Rows Count:', formatData.rows.length);

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

test();
