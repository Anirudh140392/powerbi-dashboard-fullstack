
import dotenv from 'dotenv';
dotenv.config();

const runDebug = async () => {
    try {
        const { default: sequelize } = await import('./src/config/db.js');
        const { default: watchTowerService } = await import('./src/services/watchTowerService.js');
        const dayjs = (await import('dayjs')).default;

        console.log("Starting Brands Overview Debug...");
        await sequelize.authenticate();
        console.log("Database connected.");

        // Test Filters
        const filters = {
            months: 1,
            brand: 'All', // Get all brands
            platform: 'Zepto', // Filter by platform
            location: 'All',
            brandsOverviewPlatform: 'Zepto',
            brandsOverviewCategory: 'Bath & Body' // Testing specific category
        };

        console.log("Calling getSummaryMetrics with:", filters);
        const result = await watchTowerService.getSummaryMetrics(filters);

        console.log("--- Brands Overview Result ---");
        if (result.brandsOverview && result.brandsOverview.length > 0) {
            console.log(`Found ${result.brandsOverview.length} brands.`);
            // Log first 2 brands
            console.log(JSON.stringify(result.brandsOverview.slice(0, 2), null, 2));
        } else {
            console.log("No brandsOverview data found.");
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        try {
            const { default: sequelize } = await import('./src/config/db.js');
            await sequelize.close();
        } catch (e) { }
    }
};

runDebug();
