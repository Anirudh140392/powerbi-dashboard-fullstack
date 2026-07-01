import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import availabilityService from '../backend/src/services/availabilityService.js';

async function test() {
    try {
        console.log('Testing getAvailabilityCompetitionBrandTrends on Daily timeStep...');
        const brandTrends = await availabilityService.getAvailabilityCompetitionBrandTrends({
            platform: 'Blinkit',
            category: 'GMFC',
            period: '1M',
            timeStep: 'Daily'
        });

        const brandNames = Object.keys(brandTrends.doi || {});
        console.log('Brands found:', brandNames);
        if (brandNames.length > 0) {
            const firstBrand = brandNames[0];
            const doiTrend = brandTrends.doi[firstBrand];
            console.log(`DOI daily trends for ${firstBrand}:`, doiTrend.slice(0, 10));
        }

        console.log('\nTesting getAvailabilityCompetitionSkuTrends on Daily timeStep...');
        const skuTrends = await availabilityService.getAvailabilityCompetitionSkuTrends({
            platform: 'Blinkit',
            category: 'GMFC',
            period: '1M',
            timeStep: 'Daily'
        });

        const skuNames = Object.keys(skuTrends.doi || {});
        console.log('SKUs found:', skuNames);
        if (skuNames.length > 0) {
            const firstSku = skuNames[0];
            const doiTrend = skuTrends.doi[firstSku];
            console.log(`DOI daily trends for ${firstSku}:`, doiTrend.slice(0, 10));
        }

    } catch (err) {
        console.error('Error during test:', err);
    }
    process.exit(0);
}

test();
