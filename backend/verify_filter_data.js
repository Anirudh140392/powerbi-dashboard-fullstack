import 'dotenv/config';
import performanceMarketingService from './src/services/performanceMarketingService.js';

async function testFilters() {
    try {
        console.log("Testing PM Filter APIs...");

        console.log("1. Fetching Platforms...");
        const platforms = await performanceMarketingService.getPlatforms();
        console.log("✅ Platforms:", platforms);

        console.log("\n2. Fetching Brands...");
        const brands = await performanceMarketingService.getBrands('All');
        console.log("✅ Brands (All):", brands);

        console.log("\n3. Fetching Zones...");
        const zones = await performanceMarketingService.getZones('All');
        console.log("✅ Zones (All):", zones);

    } catch (e) {
        console.error("❌ Filter verification failed:", e);
    }
}

testFilters();
