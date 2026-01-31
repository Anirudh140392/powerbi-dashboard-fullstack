import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';

async function verifyService() {
    try {
        await sequelize.authenticate();
        console.log("✅ DB Connected");

        console.log("\n--- Testing getSummaryMetrics ---");
        const summary = await watchTowerService.getSummaryMetrics({ platform: 'Zepto' });
        console.log("Summary:", summary);

        console.log("\n--- Testing getPlatformOverview ---");
        const overview = await watchTowerService.getPlatformOverview({});
        console.log("Overview (first item):", overview[0]);

        console.log("\n--- Testing getTrends ---");
        const trends = await watchTowerService.getTrends({ platform: 'Zepto' });
        console.log("Trends (first 3):", trends.timeSeries.slice(0, 3));

    } catch (error) {
        console.error("❌ Verification Failed:", error);
    } finally {
        await sequelize.close();
    }
}

verifyService();
