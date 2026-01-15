import 'dotenv/config';
import performanceMarketingService from './src/services/performanceMarketingService.js';
import sequelize from './src/config/db.js';

async function testService() {
    try {
        await sequelize.authenticate();
        console.log("DB Connected.");

        const filters = {
            platform: 'All',
            brand: 'All',
            location: 'All',
            startDate: '2024-01-01', // Use a wide range
            endDate: '2025-12-31'
        };

        const result = await performanceMarketingService.getKpisOverview(filters);
        console.log("Service Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Service Error:", error);
    } finally {
        await sequelize.close();
    }
}

testService();
