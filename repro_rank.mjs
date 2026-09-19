import visibilityService from './backend/src/services/visibilityService.js';

async function test() {
    process.env.CLICKHOUSE_DB = 'mamaearth';
    const filters = {
        platform: 'Flipkart',
        filter: ['All'],
        startDate: '2026-03-01',
        endDate: '2026-03-23',
        viewMode: 'keyword'
    };

    console.log('Testing "My SKU" rank for Flipkart...');
    try {
        const res = await visibilityService.getTopSearchTerms(filters);
        if (res.terms.length > 0) {
            const first = res.terms[0];
            console.log('Keyword:', first.keyword);
            console.log('All SKU Rank (overallPos):', first.overallPos);
            console.log('My SKU Rank (organicPos):', first.organicPos);
            console.log('My SKU Rank (paidPos):', first.paidPos);
            
            // Log some more to see if any have data
            const withData = res.terms.filter(t => t.organicPos > 0 || t.paidPos > 0);
            console.log('Terms with My SKU rank data:', withData.length, 'out of', res.terms.length);
            if (withData.length > 0) {
                console.log('Sample term with data:', withData[0].keyword, 'Organic Pos:', withData[0].organicPos);
            }
        } else {
            console.log('No terms returned');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
