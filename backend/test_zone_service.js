
import performanceMarketingService from './src/services/performanceMarketingService.js';
import sequelize from './src/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        console.log("Testing performanceMarketingService.getZones()...");
        const zones = await performanceMarketingService.getZones();
        console.log("Result:", zones);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
}

test();
