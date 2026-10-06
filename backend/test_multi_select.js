process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';
console.log('Service imported');
const { getTrendsFilterOptions, getCompetitionFilterOptions, getProducts } = watchTowerService;
console.log('Functions extracted');

async function runTests() {
    console.log('--- Testing Multi-Select Filters ---\n');

    try {
        // Test 1: Trends Categories with multiple platforms
        console.log('Test 1: getTrendsFilterOptions (categories) with multiple platforms [Blinkit, Zepto]');
        const trendsCats = await getTrendsFilterOptions({
            filterType: 'categories',
            platform: ['Blinkit', 'Zepto']
        });
        console.log('Categories for Blinkit & Zepto:', trendsCats.options);

        // Test 2: Competition Brands with multiple categories
        console.log('\nTest 2: getCompetitionFilterOptions (brands) with multiple categories');
        const compBrands = await getCompetitionFilterOptions({
            category: ['Chocolates (Gifting)', 'Chocolates (Non Gifting)'],
            context: 'competition'
        });
        console.log('Brands for multiple categories (sample 5):', compBrands.brandOptions.slice(0, 5));

        // Test 3: getProducts with multiple brands
        // We'll pick two brands if available
        if (compBrands.brandOptions.length > 1) {
            const selectedBrands = [compBrands.brandOptions[0], compBrands.brandOptions[1]];
            console.log(`\nTest 3: getProducts with multiple brands ${JSON.stringify(selectedBrands)}`);
            const products = await getProducts({
                brand: selectedBrands
            });
            console.log(`Found ${products.length} products for multiple brands.`);
            if (products.length > 0) console.log('Sample products:', products.slice(0, 3));
        }

        // Test 4: Category restriction check
        console.log('\nTest 4: Verifying category restriction in getTrendsFilterOptions');
        const allCats = await getTrendsFilterOptions({ filterType: 'categories' });
        const forbidden = allCats.options.filter(c => !["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"].includes(c));
        if (forbidden.length === 0) {
            console.log('SUCCESS: Only allowed categories found:', allCats.options);
        } else {
            console.log('FAILURE: Found restricted categories:', forbidden);
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTests();
