
import { queryClickHouse, getCurrentDbName } from './backend/src/config/clickhouse.js';
import performanceMarketingService from './backend/src/services/performanceMarketingService.js';

async function test() {
    try {
        console.log("Current DB:", getCurrentDbName());
        const categories = await performanceMarketingService.getCategories();
        console.log("Fetched Categories:", categories);
    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
