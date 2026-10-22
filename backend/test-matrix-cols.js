import { connectClickHouse } from './src/config/clickhouse.js';
import visibilityService from './src/services/visibilityService.js';

async function test() {
    await connectClickHouse();
    const filters = {
        platform: 'All',
        startDate: '2025-10-01',
        endDate: '2026-05-03'
    };
    try {
        const matrix = await visibilityService.getPlatformKpiMatrix(filters);
        console.log("Matrix platforms columns:", matrix.platformData.columns);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
