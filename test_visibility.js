import 'dotenv/config';
import { VisibilityService } from './backend/src/services/visibilityService.js';

async function test() {
    const service = new VisibilityService();
    const filters = {
        platform: 'All',
        location: 'All',
        brand: 'All'
    };


    console.log('Testing getKeywordsAtGlance...');
    try {
        const keywords = await service.getKeywordsAtGlance(filters);
        console.log('Keywords hierarchy length:', keywords.hierarchy?.length);
        if (keywords.hierarchy?.length > 0) {
            console.log('First root node:', JSON.stringify(keywords.hierarchy[0], null, 2).substring(0, 500));
        }
    } catch (err) {
        console.error('Error in getKeywordsAtGlance:', err);
    }

    console.log('\nTesting getTopSearchTerms...');
    try {
        const terms = await service.getTopSearchTerms(filters);
        console.log('Terms length:', terms.terms?.length);
        if (terms.terms?.length > 0) {
            console.log('First term:', JSON.stringify(terms.terms[0], null, 2));
        }
    } catch (err) {
        console.error('Error in getTopSearchTerms:', err);
    }

    process.exit(0);
}

test();
