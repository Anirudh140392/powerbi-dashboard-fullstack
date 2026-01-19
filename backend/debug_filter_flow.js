
import dotenv from 'dotenv';
dotenv.config();
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';

const debugFilterFlow = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        // Scenario 1: Default Load (No filters, just platform)
        // Frontend likely sends: { platform: 'Zepto', months: 1 } (or similar default)
        console.log("\n--- Scenario 1: Default Load ---");
        const defaultFilters = {
            platform: 'Zepto',
            months: 1
        };
        const defaultResult = await watchTowerService.getSummaryMetrics(defaultFilters);
        console.log("Default Result Offtakes:", defaultResult.summaryMetrics.offtakes);

        // Scenario 2: User selects "Godrej Professional" and "Ahmedabad" and Date Range "Oct 1 - Oct 7"
        // Frontend sends explicit start/end dates.
        console.log("\n--- Scenario 2: Brand + Location + Explicit Dates ---");
        const explicitFilters = {
            platform: 'Zepto',
            brand: 'Godrej Professional',
            location: 'Ahmedabad',
            startDate: '2025-10-01',
            endDate: '2025-10-07'
        };
        const explicitResult = await watchTowerService.getSummaryMetrics(explicitFilters);
        console.log("Explicit Result Offtakes:", explicitResult.summaryMetrics.offtakes);
        console.log("Explicit Result Availability:", explicitResult.summaryMetrics.stockAvailability);

        // Scenario 3: Just Brand + Explicit Dates
        console.log("\n--- Scenario 3: Brand Only + Explicit Dates ---");
        const brandFilters = {
            platform: 'Zepto',
            brand: 'Godrej Professional',
            startDate: '2025-10-01',
            endDate: '2025-10-07'
        };
        const brandResult = await watchTowerService.getSummaryMetrics(brandFilters);
        console.log("Brand Result Offtakes:", brandResult.summaryMetrics.offtakes);

    } catch (error) {
        console.error("Error debugging filter flow:", error);
    } finally {
        await sequelize.close();
    }
};

debugFilterFlow();
