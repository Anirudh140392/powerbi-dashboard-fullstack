
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
            brand: 'Godrej No.1',
            location: 'Yamunanagar',
            platform: 'Zepto', // Main filter
            monthOverviewPlatform: 'Zepto', // Month Overview filter
            categoryOverviewPlatform: 'Zepto', // Category Overview filter
            startDate: '2025-10-01',
            endDate: '2025-12-08'
        };

        console.log("Filters:", filters);

        const data = await watchTowerService.getSummaryMetrics(filters);

        if (data.monthOverview && data.monthOverview.length > 0) {
            console.log("\n--- Month Overview Data Sample (First Month) ---");
            console.log(JSON.stringify(data.monthOverview[0], null, 2));
        }

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

        console.log("\n--- Category Overview Data (Zepto) ---");
        if (data.categoryOverview && data.categoryOverview.length > 0) {
            data.categoryOverview.forEach(cat => {
                console.log(`\nCategory: ${cat.label}`);
                if (cat.columns) {
                    cat.columns.forEach(col => {
                        console.log(`  ${col.title}: ${col.value}`);
                    });
                }
            });
        } else {
            console.log("No Category Overview data found.");
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
};

runDebug();
