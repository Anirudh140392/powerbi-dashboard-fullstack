import { getPricingInsights } from './src/services/pricingAnalysisService.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
    try {
        console.log("Testing getPricingInsights...");
        const result = await getPricingInsights({
            categories: [], // Any
            platforms: [], // Any
            startDate: '2025-02-18',
            endDate: '2026-03-05',
            compareStartDate: '2025-02-01',
            compareEndDate: '2026-02-18'
        });

        if (result.success) {
            console.log("✅ API Success");
            const allSkus = [
                ...(result.my_skus_drop || []),
                ...(result.my_skus_hike || []),
                ...(result.comp_skus_drop || []),
                ...(result.comp_skus_hike || [])
            ];

            if (allSkus.length > 0) {
                console.log(`\nFound ${allSkus.length} SKUs with price changes.`);
                const samples = allSkus.slice(0, 3);
                
                samples.forEach((sku, idx) => {
                    console.log(`\n--- SKU ${idx + 1}: ${sku.title} ---`);
                    console.log(`Global OSA: ${sku.osa}%`);
                    console.log(`Global Listing: ${sku.listing}%`);
                    if (sku.cities && sku.cities.length > 0) {
                        console.log(`City Breakdown (first 3):`);
                        console.table(sku.cities.slice(0, 3).map(c => ({
                            City: c.name,
                            Discount: c.discount + '%',
                            Change: c.change + '%',
                            OSA: c.osa + '%',
                            Listing: (c.listing || 0) + '%'
                        })));
                    }
                });
            } else {
                console.log("❌ No SKUs found with the specified filters/dates.");
            }
        } else {
            console.error("❌ API Failed:", result.message);
        }
    } catch (e) {
        console.error("❌ Error during test execution:", e);
    }
}

test();
