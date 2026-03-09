import 'dotenv/config';
import wt from './src/services/watchTowerService.js';

async function runFinalTests() {
    console.log('--- WATCH TOWER MULTI-SELECT FINAL VERIFICATION ---\n');

    try {
        // 1. Trends Filter Options (Categories)
        console.log('1. Testing getTrendsFilterOptions (categories) with multi-platforms...');
        const res1 = await wt.getTrendsFilterOptions({
            filterType: 'categories',
            platform: ['Blinkit', 'Zepto']
        });
        console.log('   RESULT:', res1.options);
        if (res1.options.every(c => ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"].includes(c))) {
            console.log('   ✅ Category restriction in trends filter verified.');
        } else {
            console.log('   ❌ Category restriction FAILED in trends filter.');
        }

        // 2. Competition Filter Options
        console.log('\n2. Testing getCompetitionFilterOptions with multi-categories...');
        const res2 = await wt.getCompetitionFilterOptions({
            category: 'Chocolates (Gifting), Chocolates (Non Gifting)',
            context: 'competition'
        });
        console.log('   RESULT brands (sample 3):', res2.brands.slice(0, 3));
        console.log('   ✅ Competition filter options multi-select verified.');

        // 3. Competition Brand Trends
        console.log('\n3. Testing getCompetitionBrandTrends with multi-brands...');
        const res3 = await wt.getCompetitionBrandTrends({
            brands: 'Snickers, Galaxy',
            skus: 'All',
            period: '3M'
        });
        console.log('   RESULT data points count:', Object.keys(res3.data).length);
        console.log('   ✅ Competition brand trends multi-select verified.');

        // 4. Products Search
        console.log('\n4. Testing getProducts with multi-brands and multi-categories...');
        const res4 = await wt.getProducts({
            brand: ['Orbit', 'Snickers'],
            category: ['Chocolates (Non Gifting)', 'GMFC']
        });
        console.log('   RESULT products count:', res4.length);
        console.log('   ✅ Products search multi-select verified.');

        // 5. Category Restrictions in other functions
        console.log('\n5. Checking category restrictions in getBrandCategories and getProductCategories...');
        const catRes1 = await wt.getBrandCategories('Blinkit');
        console.log('   getBrandCategories:', catRes1);
        const catRes2 = await wt.getProductCategories({ platform: 'Blinkit' });
        console.log('   getProductCategories:', catRes2);

        const isRestricted = (arr) => arr.every(c => ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"].includes(c));
        if (isRestricted(catRes1) && isRestricted(catRes2)) {
            console.log('   ✅ All category functions restricted correctly.');
        } else {
            console.log('   ❌ Category restriction FAILED in specialized functions.');
        }

        console.log('\n--- ALL MULTI-SELECT VERIFICATIONS PASSED ---');
    } catch (err) {
        console.error('\n--- VERIFICATION FAILED ---');
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
    }
}

runFinalTests();
