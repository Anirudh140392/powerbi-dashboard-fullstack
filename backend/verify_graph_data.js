import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';

const verifyGraphData = async () => {
    try {
        console.log("Verifying Graph Data Population...");

        // Use filters that are known to have data (e.g., Godrej Ezee)
        const filters = {
            months: '6',
            brand: 'Godrej Ezee',
            location: 'All',
            platform: 'All'
        };

        console.log("Calling getSummaryMetrics with filters:", filters);
        const result = await watchTowerService.getSummaryMetrics(filters);

        console.log("\n--- Top Metrics Charts ---");
        result.topMetrics.forEach(m => {
            console.log(`\nMetric: ${m.name}`);
            console.log(`Chart Length: ${m.chart.length}`);
            console.log(`Chart Values: ${JSON.stringify(m.chart)}`);

            const hasData = m.chart.some(v => v > 0);
            console.log(`Has Non-Zero Data: ${hasData}`);
        });

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        await sequelize.close();
    }
};

verifyGraphData();
