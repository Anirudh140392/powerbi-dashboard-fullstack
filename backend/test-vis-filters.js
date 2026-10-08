import { connectClickHouse } from './src/config/clickhouse.js';
import visibilityService from './src/services/visibilityService.js';

async function test() {
    await connectClickHouse();
    try {
        const res = await visibilityService.getVisibilityFilterOptions({ filterType: 'platforms' });
        console.log(res);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
