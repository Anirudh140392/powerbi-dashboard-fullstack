
import * as pricingAnalysisService from './src/services/pricingAnalysisService.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log("--- Testing Category Dimension (All Filters) ---");
    const result = await pricingAnalysisService.getDimensionOverview({
        dimension: 'category',
        startDate: '2026-03-01',
        endDate: '2026-03-10'
    });

    if (result.success) {
        console.log(`Found ${result.data?.length || 0} categories:`);
        console.log(result.data.map(d => d.name));
    } else {
        console.error("Error:", result.error);
    }
}

test().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
