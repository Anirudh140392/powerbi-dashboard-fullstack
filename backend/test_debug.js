import 'dotenv/config';
import wt from './src/services/watchTowerService.js';

async function debugAll() {
    console.log('--- STARTING ALL DEBUG TESTS ---\n');
    try {
        // 1. Trends Categories with multiple platforms
        console.log('Test 1: getTrendsFilterOptions (categories) with platform: ["Blinkit", "Zepto"]');
        const trendsCats = await wt.getTrendsFilterOptions({
            filterType: 'categories',
            platform: ['Blinkit', 'Zepto']
        });
        console.log('Test 1 SUCCESS:', trendsCats.options);

        // 2. Competition Brands with multiple categories
        console.log('\nTest 2: getCompetitionFilterOptions (brands) with category: "Chocolates (Gifting), Chocolates (Non Gifting)"');
        const compResult = await wt.getCompetitionFilterOptions({
            category: 'Chocolates (Gifting), Chocolates (Non Gifting)',
            context: 'competition'
        });
        console.log('Test 2 SUCCESS, Sample Brands:', compResult.brandOptions.slice(0, 3));

        // 3. getProducts with multiple brands
        console.log('\nTest 3: getProducts with brand: ["Orbit", "Snickers"]');
        const products = await wt.getProducts({
            brand: ['Orbit', 'Snickers']
        });
        console.log(`Test 3 SUCCESS: Found ${products.length} products.`);

        // 4. Competition Brand Trends with multiple brands
        console.log('\nTest 4: getCompetitionBrandTrends with brands: "Snickers, Galaxy"');
        const trends = await wt.getCompetitionBrandTrends({
            brands: 'Snickers, Galaxy',
            period: '3M'
        });
        console.log('Test 4 SUCCESS: Trends data keys count:', Object.keys(trends.data).length);

        console.log('\n--- ALL TESTS FINISHED ---');
    } catch (err) {
        console.error('\n--- ERROR CAUGHT ---');
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
    }
}

debugAll();
