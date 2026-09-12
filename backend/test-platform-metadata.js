import watchTowerService from './src/services/watchTowerService.js';
import { dbStorage } from './src/config/clickhouse.js';

async function test() {
    await dbStorage.run({ dbName: 'hm_stahl' }, async () => {
        const res = await watchTowerService.getPlatformMetadata();
        console.log(res);
    });
}

test().catch(console.error);
