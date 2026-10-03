
import * as pricingAnalysisService from './src/services/pricingAnalysisService.js';
import dotenv from 'dotenv';
dotenv.config();

async function verify() {
    console.log("--- Verification 1: City Dimension with Granular Category 'Snickers' ---");
    const result = await pricingAnalysisService.getDimensionOverview({
        dimension: 'city',
        category: 'Snickers',
        startDate: '2026-03-01',
        endDate: '2026-03-10'
    });

    if (result.success && result.data?.length > 0) {
        console.log(`✅ Success! Found ${result.data.length} cities for Snickers.`);
        console.log("Sample cities:", result.data.slice(0, 3).map(d => d.name));
    } else {
        console.log("❌ Failed: No data returned for Snickers. Current count:", result.data?.length);
    }

    console.log("\n--- Verification 2: City Dimension with Category Bucket 'GMFC' ---");
    const result2 = await pricingAnalysisService.getDimensionOverview({
        dimension: 'city',
        category: 'GMFC',
        startDate: '2026-03-01',
        endDate: '2026-03-10'
    });

    if (result2.success && result2.data?.length > 0) {
        console.log(`✅ Success! Found ${result2.data.length} cities for GMFC.`);
    } else {
        console.log("❌ Failed: No data returned for GMFC.");
    }
}

verify().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
