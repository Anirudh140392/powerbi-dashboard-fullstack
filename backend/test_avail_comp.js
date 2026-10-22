import { connectClickHouse } from './src/config/clickhouse.js';
import availabilityService from './src/services/availabilityService.js';

async function run() {
    await connectClickHouse();
    console.log('--- testing getAvailabilityCompetitionData ---');
    try {
        const result = await availabilityService.getAvailabilityCompetitionData({
            platform: 'All',
            location: 'All',
            category: 'All',
            brand: 'All',
            period: '1M'
        });
        console.log('Got response (first 2 brands):');
        console.log(JSON.stringify(result.brands.slice(0, 2), null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run().catch(console.error);
