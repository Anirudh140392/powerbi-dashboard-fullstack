
import dotenv from 'dotenv';
dotenv.config();

import dayjs from 'dayjs';

const runDebug = async () => {
    // Dynamic import to ensure env vars are loaded first
    const { default: watchTowerService } = await import('./src/services/watchTowerService.js');
    const { default: sequelize } = await import('./src/config/db.js');

    try {
        console.log("--- Debugging Zepto Response ---");

        const filters = {
            months: 6,
            brand: 'Aer',
            location: 'Agra',
            platform: 'Zepto', // Main filter
            monthOverviewPlatform: 'Zepto', // Month Overview filter
            startDate: '2025-10-01',
            endDate: '2025-12-08'
        };

        console.log("Filters:", filters);

        const data = await watchTowerService.getSummaryMetrics(filters);

        console.log("\n--- Month Overview Data (Zepto) ---");
        if (data.monthOverview && data.monthOverview.length > 0) {
            data.monthOverview.forEach(month => {
                console.log(`\nMonth: ${month.label}`);
                month.columns.forEach(col => {
                    console.log(`  ${col.title}: ${col.value}`);
                });
            });
        } else {
            console.log("No Month Overview data found.");
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
};

runDebug();
