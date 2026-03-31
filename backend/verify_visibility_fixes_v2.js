
import visibilityService from './src/services/visibilityService.js';

async function verifyFixes() {
    try {
        console.log('--- Verifying Visibility Service Fixes (Round 2) ---');

        // Test 1: Latest Dates
        const dates = await visibilityService.getLatestAvailableDates();
        console.log('\nLatest Dates:', JSON.stringify(dates, null, 2));

        // Test 2: Filter Options (Brands)
        console.log('\nTesting getVisibilityFilterOptions (brands)...');
        const brands = await visibilityService.getVisibilityFilterOptions({ filterType: 'brands' });
        console.log('Available Brands:', brands.options.slice(0, 10));

        // Test 3: Keywords at a Glance with a non-Mars brand
        const testBrand = brands.options[1] || 'Cadbury';
        console.log(`\nTesting getKeywordsAtGlance for brand: ${testBrand}...`);
        const keywordsRes = await visibilityService.getKeywordsAtGlance({ brand: testBrand });
        console.log('Hierarchy root count:', keywordsRes.hierarchy.length);
        if (keywordsRes.hierarchy.length > 0) {
            console.log('First keyword metrics:', JSON.stringify(keywordsRes.hierarchy[0].children[0]?.metrics));
        }

        // Test 4: Top Search Terms
        console.log('\nTesting getTopSearchTerms...');
        const searchTermsRes = await visibilityService.getTopSearchTerms({});
        console.log('Terms count:', searchTermsRes.terms.length);
        if (searchTermsRes.terms.length > 0) {
            console.log('First term sample:', JSON.stringify(searchTermsRes.terms[0], null, 2));
        }

    } catch (err) {
        console.error('Verification failed:', err);
    }
}

verifyFixes();
