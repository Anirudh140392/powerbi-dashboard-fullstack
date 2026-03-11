
import visibilityService from './src/services/visibilityService.js';

async function testSos() {
    try {
        console.log('--- Testing Dynamic SOS for Cadbury ---');
        const results = await visibilityService.getKeywordsAtGlance({ 
            brand: 'Cadbury',
            platform: 'Blinkit',
            city: 'All',
            format: 'All'
        });
        
        console.log('\nResults for Cadbury:');
        if (results.hierarchy && results.hierarchy.length > 0) {
            results.hierarchy.forEach(typeNode => {
                console.log(`\nType: ${typeNode.label} (SOS: ${typeNode.metrics.overallSos}%)`);
                if (typeNode.children && typeNode.children.length > 0) {
                    console.log('Top 3 Keywords:');
                    typeNode.children.slice(0, 3).forEach(kw => {
                        console.log(` - ${kw.label}: ${kw.metrics.overallSos}%`);
                    });
                }
            });
        } else {
            console.log('No data found for Cadbury');
        }

        console.log('\n--- Testing Top Search Terms ---');
        const terms = await visibilityService.getTopSearchTerms({
            brand: 'Cadbury'
        });
        console.log('Terms count:', terms.terms.length);
        if (terms.terms.length > 0) {
            console.log('Sample term:', JSON.stringify(terms.terms[0], null, 2));
        }

    } catch (err) {
        console.error('Test failed:', err);
    }
}

testSos();
