
import visibilityService from './src/services/visibilityService.js';

async function verifyFixes() {
    try {
        console.log('--- Verifying Visibility Service Fixes ---');

        // Test 1: Keywords at a Glance
        console.log('\nTesting getKeywordsAtGlance...');
        const keywordsRes = await visibilityService.getKeywordsAtGlance({});
        console.log('Hierarchy root count:', keywordsRes.hierarchy.length);
        if (keywordsRes.hierarchy.length > 0) {
            console.log('First type:', keywordsRes.hierarchy[0].label);
            console.log('First keyword sample:', JSON.stringify(keywordsRes.hierarchy[0].children[0]?.label));
            console.log('First keyword metrics:', JSON.stringify(keywordsRes.hierarchy[0].children[0]?.metrics));
        }

        // Test 2: Top Search Terms
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
