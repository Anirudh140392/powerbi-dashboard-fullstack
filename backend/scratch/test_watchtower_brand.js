import watchTowerService from '../src/services/watchTowerService.js';
import { dbStorage } from '../src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testWatchtowerBrand() {
    await dbStorage.run({ dbName: 'pidilite' }, async () => {
        try {
            console.log("=== CALLING watchTowerService.getKpiTrends with brand='fevicol' ===");
            const res = await watchTowerService.getKpiTrends({
                platform: 'zepto',
                brand: 'fevicol',
                period: 'Custom',
                startDate: '2026-09-08',
                endDate: '2026-09-08',
                timeStep: 'Daily'
            });
            console.log("Response TimeSeries:", res.timeSeries);
        } catch (err) {
            console.error("Error:", err);
        }
    });
    process.exit(0);
}

testWatchtowerBrand();
