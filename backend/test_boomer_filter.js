import { getPricingCompetition } from './src/services/pricingAnalysisService.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        const filters = {
            platform: 'All',
            brand: 'Boomer',
            dimension: 'category',
            dimensionValue: 'GMFC',
            period: '1M'
        };
        console.log("Calling getPricingCompetition with filters:", filters);
        const result = await getPricingCompetition(filters);
        console.log("Success:", result.success);
        if (result.success) {
            console.log("Brands found:", result.brands?.length || 0);
            if (result.brands && result.brands.length > 0) {
                console.log("First brand:", result.brands[0]);
            } else {
                console.log("No brands returned.");
            }
        } else {
            console.log("Error:", result.error);
        }
    } catch (error) {
        console.error("CRITICAL ERROR:", error);
    }
}

test();
