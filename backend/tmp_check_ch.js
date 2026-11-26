import { connectClickHouse } from './src/config/clickhouse.js';
import watchTowerService from './src/services/watchTowerService.js';

async function run() {
    await connectClickHouse();
    console.log('--- testing getCompetitionData ---');
    const result = await watchTowerService.getCompetitionData({
        platform: 'All',
        location: 'All',
        category: 'All',
        brand: 'All',
        period: '1M'
    });
    console.log('Got response:');
    console.log(JSON.stringify(result, null, 2).slice(0, 1000));
    process.exit(0);
}
run().catch(console.error);
