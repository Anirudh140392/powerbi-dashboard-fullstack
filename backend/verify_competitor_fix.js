import visibilityService from './src/services/visibilityService.js';

async function verifyFix() {
    try {
        console.log('Testing getTopSearchTerms with filter: "Competitor"...');
        const result = await visibilityService.getTopSearchTerms({
            filter: 'Competitor',
            platform: 'All',
            location: 'All',
            brand: 'All'
        });

        if (result && result.terms && result.terms.length > 0) {
            console.log(`Success! Found ${result.terms.length} competitor search terms.`);
            console.log('Sample terms:');
            result.terms.slice(0, 5).forEach(t => {
                console.log(`- ${t.keyword} (Overall SOS: ${t.overallSos}%)`);
            });
        } else {
            console.error('Failure: No competitor search terms found.');
        }
    } catch (error) {
        console.error('Error during verification:', error);
    }
}

verifyFix();
