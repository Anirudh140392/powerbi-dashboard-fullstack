
import 'dotenv/config';
import { getPricingKpis } from '../src/services/pricingAnalysisService.js';
import dayjs from 'dayjs';

async function test() {
    console.log('--- Testing Pricing KPIs ---');

    // Test with default filters
    const filters = {
        startDate: '2025-01-01',
        endDate: '2025-01-15',
        platform: 'All',
        location: 'All',
        brand: 'Colgate'
    };

    try {
        const result = await getPricingKpis(filters);
        console.log('Result:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('✅ getPricingKpis success!');
            const d = result.data;
            console.log(`Discount: ${d.discount.value.toFixed(2)}%`);
            console.log(`Weighted Discount: ${d.weightedDiscount.value.toFixed(2)}%`);
            console.log(`Price Per Unit: ${d.pricePerUnit.value.toFixed(2)}`);
            console.log(`RPI: ${d.rpi.value.toFixed(3)}`);
        } else {
            console.error('❌ getPricingKpis failed:', result.error);
        }
    } catch (err) {
        console.error('Error during test:', err);
    }
}

test();
