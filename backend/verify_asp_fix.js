import { getPricingKpis } from './src/services/pricingAnalysisService.js';

async function verify() {
    try {
        console.log("Calling getPricingKpis with dummy filters...");
        const result = await getPricingKpis({
            startDate: '2024-03-01',
            endDate: '2024-03-15',
            brand: 'Orbit'
        });
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error during verification:", error);
    }
}

verify();
