import availabilityService from '../src/services/availabilityService.js';
import watchTowerService from '../src/services/watchTowerService.js';
import { dbStorage } from '../src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testKpiTrends() {
    await dbStorage.run({ dbName: 'pidilite' }, async () => {
        try {
            console.log("=== 1. CALLING availabilityService.getAvailabilityKpiTrends for Fevicol in pidilite DB ===");
            const resAvail = await availabilityService.getAvailabilityKpiTrends({
                platform: 'zepto',
                brand: 'fevicol',
                period: 'Custom',
                startDate: '2026-09-08',
                endDate: '2026-09-08',
                timeStep: 'Daily'
            });
            console.log("Availability Service Response for Fevicol:", JSON.stringify(resAvail, null, 2));

            console.log("\n=== 2. CALLING watchTowerService.getKpiTrends for Fevicol in pidilite DB ===");
            const resWatch = await watchTowerService.getKpiTrends({
                platform: 'zepto',
                brand: 'fevicol',
                period: 'Custom',
                startDate: '2026-09-08',
                endDate: '2026-09-08',
                timeStep: 'Daily'
            });
            console.log("WatchTower Service Response for Fevicol:", JSON.stringify(resWatch, null, 2));

            console.log("\n=== 3. CALLING watchTowerService.getKpiTrends WITHOUT BRAND FILTER (ZEPTO ALL) in pidilite DB ===");
            const resWatchAll = await watchTowerService.getKpiTrends({
                platform: 'zepto',
                period: 'Custom',
                startDate: '2026-09-08',
                endDate: '2026-09-08',
                timeStep: 'Daily'
            });
            console.log("WatchTower Service Response for Zepto All:", JSON.stringify(resWatchAll, null, 2));

        } catch (err) {
            console.error("Error testing KPI trends:", err);
        }
    });
    process.exit(0);
}

testKpiTrends();
