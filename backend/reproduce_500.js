import inventoryAnalysisService from './src/services/inventoryAnalysisService.js';
import dotenv from 'dotenv';
import path from 'path';

// Fix for loading .env correctly
dotenv.config({ path: path.resolve('backend', '.env') });
// Also try default path just in case
dotenv.config();

async function run() {
    try {
        console.log("Testing getInventoryOverview...");
        // Mock filters based on user screenshot: Platform=Zepto, Brand=All, Location=All, Period=01-01-2026 - 27-01-2026
        const filters = {
            platform: 'Zepto',
            brand: 'All',
            location: 'All',
            category: 'All',
            startDate: '2026-01-01',
            endDate: '2026-01-27',
            compareStartDate: '2025-12-05',
            compareEndDate: '2025-12-31'
        };

        const result = await inventoryAnalysisService.getInventoryOverview(filters);
        console.log("✅ Success!");
        console.log(JSON.stringify(result, null, 2).substring(0, 200));

    } catch (error) {
        console.error("❌ Caught Error:");
        console.error(error);
        if (error.stack) console.error(error.stack);
    }
}

run();
