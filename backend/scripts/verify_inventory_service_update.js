import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('backend', '.env') });
import inventoryAnalysisService from './src/services/inventoryAnalysisService.js';


// Mock console.log/error to prevent noise if needed, or keep for visibility
// console.log = () => {};

async function verify() {
    try {
        console.log("Testing getInventoryOverview...");
        const overview = await inventoryAnalysisService.getInventoryOverview({
            startDate: '2026-01-01',
            endDate: '2026-01-07',
            platform: 'All',
            brand: 'All',
            location: 'All',
            category: 'All'
        });
        console.log("Overview keys:", Object.keys(overview));
        console.log("Overview metrics:", Object.keys(overview.metrics));

        console.log("\nTesting getPlatforms...");
        const platforms = await inventoryAnalysisService.getPlatforms();
        console.log("Platforms:", platforms.slice(0, 5));

        console.log("\nTesting getInventoryMatrix...");
        const matrix = await inventoryAnalysisService.getInventoryMatrix({
            startDate: '2026-01-01',
            endDate: '2026-01-07',
            platform: 'All',
            brand: 'All',
            location: 'All',
            category: 'All'
        });
        console.log("Matrix data length:", matrix.data.length);

        console.log("\n✅ Verification Successful: Service methods executed without error.");
    } catch (error) {
        console.error("\n❌ Verification Failed:", error);
    }
}

verify();
