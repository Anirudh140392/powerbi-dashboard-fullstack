
import dotenv from 'dotenv';
dotenv.config();
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';
import ZeptoMarketShare from './src/models/ZeptoMarketShare.js';
import { Op } from 'sequelize';

const debugFilters = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        // Check distinct Locations in ZeptoMarketShare
        const marketShareLocations = await ZeptoMarketShare.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'Location']],
            raw: true
        });
        console.log("Distinct Locations in ZeptoMarketShare:", marketShareLocations.map(l => l.Location));

        // Check distinct Brands in ZeptoMarketShare
        const marketShareBrands = await ZeptoMarketShare.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand')), 'brand']],
            raw: true
        });
        console.log("Distinct Brands in ZeptoMarketShare:", marketShareBrands.map(b => b.brand));

        // Check for rows with Sales > 0 but Availability (deno_osa) = 0
        const anomalyCheck = await import('./src/models/RbPdpOlap.js').then(m => m.default.findAll({
            attributes: ['Brand', 'Location', 'Sales', 'deno_osa'],
            where: {
                Sales: { [Op.gt]: 0 },
                deno_osa: '0',
                Platform: 'Zepto'
            },
            limit: 5,
            raw: true
        }));
        console.log("Rows with Sales > 0 but deno_osa = 0:", anomalyCheck);

        // Test Case 1: Default Filters (Working according to user)
        console.log("\n--- Test Case 1: Default Filters ---");
        const defaultFilters = {
            platform: 'Zepto',
            months: 1
        };
        const defaultResult = await watchTowerService.getSummaryMetrics(defaultFilters);
        console.log("Default Result Summary:", defaultResult.summaryMetrics);

        // Test Case 2: Specific Brand (e.g., 'Godrej No.1' from previous debug output)
        console.log("\n--- Test Case 2: Brand 'Godrej No.1' ---");
        const brandFilters = {
            platform: 'Zepto',
            brand: 'Godrej No.1',
            months: 1
        };
        const brandResult = await watchTowerService.getSummaryMetrics(brandFilters);
        console.log("Brand Result Summary:", brandResult.summaryMetrics);

        // Test Case 3: Specific Location (e.g., 'Mumbai' from previous debug output)
        console.log("\n--- Test Case 3: Location 'Mumbai' ---");
        const locationFilters = {
            platform: 'Zepto',
            location: 'Mumbai',
            months: 1
        };
        const locationResult = await watchTowerService.getSummaryMetrics(locationFilters);
        console.log("Location Result Summary:", locationResult.summaryMetrics);

        // Test Case 4: Brand 'Godrej No.1' + Location 'Mumbai' + 6 Months
        console.log("\n--- Test Case 4: Brand 'Godrej No.1' + Location 'Mumbai' + 6 Months ---");
        const combinedFilters = {
            platform: 'Zepto',
            brand: 'Godrej No.1',
            location: 'Mumbai',
            months: 6
        };
        const combinedResult = await watchTowerService.getSummaryMetrics(combinedFilters);
        console.log("Combined Result Summary:", combinedResult.summaryMetrics);

    } catch (error) {
        console.error("Error debugging filters:", error);
    } finally {
        await sequelize.close();
    }
};

debugFilters();
