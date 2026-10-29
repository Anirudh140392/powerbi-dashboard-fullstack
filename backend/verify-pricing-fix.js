
import { queryClickHouse } from './src/config/clickhouse.js';
import { getPricingKpis, getDimensionOverview } from './src/services/pricingAnalysisService.js';
import dayjs from 'dayjs';

async function verifyPricingFix() {
    console.log('--- Verifying Pricing Analysis Category Fix ---');

    const filters = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        category: 'GMFC' // Test with a business category
    };

    console.log('\nTesting getPricingKpis for 2026 with GMFC filter...');
    const kpis = await getPricingKpis(filters);
    console.log('KPI Result Success:', kpis.success);
    if (kpis.success) {
        console.log('Weighted Discount:', kpis.data.weighted_discount_curr);
    } else {
        console.log('KPI Error:', kpis.error);
    }

    console.log('\nTesting getDimensionOverview for 2026 (Group by Category)...');
    const overview = await getDimensionOverview({ ...filters, dimension: 'category' });
    console.log('Overview Result Success:', overview.success);
    if (overview.success && overview.data) {
        console.log('Categories found:', overview.data.map(d => d.dimension_name));
    } else {
        console.log('Overview Error:', overview.error);
    }

    process.exit(0);
}

verifyPricingFix().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
