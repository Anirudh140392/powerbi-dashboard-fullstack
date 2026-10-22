import 'dotenv/config';
import { setCurrentDbName } from '../src/config/clickhouse.js';
import { getAbsoluteOsaPlatformKpiMatrix } from '../src/services/availabilityService.js';

async function test() {
    try {
        console.log("Setting DB name to mamaearth...");
        setCurrentDbName('mamaearth');

        console.log("Calling getAbsoluteOsaPlatformKpiMatrix...");
        const filters = {
            startDate: '2026-07-01',
            endDate: '2026-07-08',
            platform: ['amazon'],
            category: ['accessories', 'headphones', 'neckbands', 'party speakers', 'soundbar', 'speaker', 'tws', 'wearables', 'wired earphones'],
            ownBrandsOnly: 'true', // sets Comp_flag = 0
            viewMode: 'Category'
        };

        const result = await getAbsoluteOsaPlatformKpiMatrix(filters);
        console.log("Result success! First row:", JSON.stringify(result.rows?.[0], null, 2));
        console.log("Total rows returned:", result.rows?.length);
    } catch (err) {
        console.error("Test failed with error:", err);
    }
}

test();
