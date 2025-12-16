import 'dotenv/config';
import service from './src/services/watchTowerService.js';
const { getSummaryMetrics } = service;

// Mock req/res
const req = {
    query: {
        startDate: '2025-10-01',
        endDate: '2025-12-09',
        platform: 'Zepto',
        brand: 'Aer',
        location: 'All'
    }
};

async function run() {
    try {
        console.log("Running getSummaryMetrics for Performance Marketing...");
        const result = await getSummaryMetrics(req.query);

        if (result.performanceMarketing) {
            console.log("Performance Marketing Metrics:");
            result.performanceMarketing.forEach(m => {
                console.log(`Title: ${m.title}`);
                console.log(`  Value: ${m.value}`);
                console.log(`  MoM: ${m.mom} (${m.momUp ? 'Up' : 'Down'})`);
                console.log(`  YoY: ${m.yoy} (${m.yoyUp ? 'Up' : 'Down'})`);
                console.log(`  Trend Data Points: ${m.data.length}`);
                console.log(`  Trend Data Sample: ${m.data.slice(0, 3).join(', ')}...`);
            });
        } else {
            console.log("No performanceMarketing data found.");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

run();
