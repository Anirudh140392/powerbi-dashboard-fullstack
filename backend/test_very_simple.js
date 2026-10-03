import 'dotenv/config';
import wt from './src/services/watchTowerService.js';

async function run() {
    console.log('--- STARTING COMPREHENSIVE VERIFICATION ---\n');

    console.log('1. getTrendsFilterOptions (Categories) with Multi-Platform...');
    try {
        const res = await wt.getTrendsFilterOptions({
            filterType: 'categories',
            platform: ['Blinkit', 'Zepto']
        });
        console.log('   ✅ Categories:', res.options);
    } catch (e) {
        console.error('   ❌ FAILED:', e.message);
    }

    console.log('\n2. getCompetitionFilterOptions (Brands) with Multi-Category...');
    try {
        const res = await wt.getCompetitionFilterOptions({
            category: 'Chocolates (Gifting), Chocolates (Non Gifting)',
            context: 'competition'
        });
        console.log('   ✅ Brands (sample 3):', res.brands.slice(0, 3));
    } catch (e) {
        console.error('   ❌ FAILED:', e.message);
    }

    console.log('\n3. getProducts with Multi-Brand and Multi-Category...');
    try {
        const res = await wt.getProducts({
            brand: ['Orbit', 'Snickers'],
            category: ['Chocolates (Non Gifting)', 'GMFC']
        });
        console.log('   ✅ Found Products count:', res.length);
    } catch (e) {
        console.error('   ❌ FAILED:', e.message);
    }

    console.log('\n4. getCompetitionBrandTrends with Multi-Brand...');
    try {
        const res = await wt.getCompetitionBrandTrends({
            brands: 'Snickers, Galaxy',
            skus: 'All',
            period: '1M'
        });
        console.log('   ✅ Trends data points count:', Object.keys(res.data).length);
    } catch (e) {
        console.error('   ❌ FAILED:', e.message);
    }

    console.log('\n5. Specialized Category Restriction Functions...');
    try {
        const catRes1 = await wt.getBrandCategories('Blinkit');
        const catRes2 = await wt.getProductCategories({ platform: 'Blinkit' });
        console.log('   getBrandCategories:', catRes1);
        console.log('   getProductCategories:', catRes2);
        const isRestricted = (arr) => arr.every(c => ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"].includes(c));
        if (isRestricted(catRes1) && isRestricted(catRes2)) {
            console.log('   ✅ All category functions restricted correctly.');
        } else {
            console.log('   ❌ Category restriction FAILED.');
        }
    } catch (e) {
        console.error('   ❌ FAILED:', e.message);
    }

    console.log('\nDONE');
}

run();
