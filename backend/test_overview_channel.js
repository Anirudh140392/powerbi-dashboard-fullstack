import 'dotenv/config';
import { dbStorage } from './src/config/clickhouse.js';
import watchTowerService from './src/services/watchTowerService.js';

dbStorage.run({ dbName: 'mamaearth' }, async () => {
    try {
        const filters = {
            channel: 'quickcomm',
            platform: 'All',
            keyword: ['All'],
            startDate: '2026-07-01',
            endDate: '2026-07-15',
            compareStartDate: '2026-06-16',
            compareEndDate: '2026-06-30'
        };
        const res = await watchTowerService.getOverview(filters);
        console.log('Overview for quickcomm + All platforms:', JSON.stringify(res.summaryMetrics));
    } catch (err) {
        console.error(err);
    }
});
