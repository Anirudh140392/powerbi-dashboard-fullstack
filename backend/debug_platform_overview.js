import 'dotenv/config';
process.env.CLICKHOUSE_DB = 'zydus';
import watchTowerService from './src/services/watchTowerService.js';

async function run() {
    const filters = {
        months: 1,
        channel: 'All'
    };
    
    try {
        console.log("Running getPlatformOverview for Zydus...");
        const data = await watchTowerService.getPlatformOverview(filters);
        console.log("Success:", data.length, "platforms found");
        if (data.length > 0) {
            console.log("Platform logos sampled:");
            data.forEach(p => {
                console.log(`- ${p.label}: ${p.logo}`);
            });
        }
    } catch (e) {
        console.error("Error caught in debug script:", e.message);
        console.error("Stack:", e.stack);
    }
}
run();
