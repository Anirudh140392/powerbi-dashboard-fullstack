import availabilityService from '../backend/src/services/availabilityService.js';
import dayjs from '../backend/node_modules/dayjs/dayjs.min.js';

async function main() {
    try {
        console.log("Calling getAvailabilityKpiTrends...");
        
        // Let's call with similar inputs as the web app
        const result = await availabilityService.getAvailabilityKpiTrends({
            period: '1M',
            timeStep: 'Daily',
            filters: {
                platform: 'blinkit',
                brand: 'galaxy',
                ownBrandsOnly: false
            }
        });
        
        console.log("Result period:", result.period);
        console.log("Result dateRange:", result.dateRange);
        console.log("Result metrics:", result.metrics);
        console.log("First 3 timeSeries data points:", result.timeSeries?.slice(0, 3));
        console.log("Last 3 timeSeries data points:", result.timeSeries?.slice(-3));
        
        // Find June 2nd and log it specifically
        const jun2 = result.timeSeries?.find(p => p.date === '02 Jun \'26' || p.date.includes('02 Jun'));
        console.log("Found June 2nd data point:", jun2);
        
    } catch (err) {
        console.error("Error running test:", err);
    }
}

main();
