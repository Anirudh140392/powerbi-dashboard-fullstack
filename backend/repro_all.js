import visibilityService from './src/services/visibilityService.js';
import dayjs from 'dayjs';

async function test() {
    process.env.CLICKHOUSE_DB = 'mamaearth';
    const filters = {
        platform: 'Flipkart',
        filter: ['All'],
        startDate: '2026-03-01',
        endDate: '2026-03-23',
        viewMode: 'keyword'
    };

    console.log('Testing "All" filter for Flipkart...');
    try {
        const res = await visibilityService.getTopSearchTerms(filters);
        console.log('Result terms count:', res.terms.length);
        if (res.terms.length > 0) {
            console.log('Sample term 1:', res.terms[0].keyword);
        } else {
            console.log('FAIL: No terms returned for "All" filter');
        }

        console.log('\nTesting SKU filter options...');
        const skuOptions = await visibilityService.getVisibilityFilterOptions({
            filterType: 'skus',
            platform: 'Flipkart'
        });
        console.log('SKU options count:', skuOptions.options.length);
        if (skuOptions.options.length > 0) {
            console.log('Sample SKU:', skuOptions.options[0]);
        } else {
            console.log('FAIL: No SKU options returned from rb_kw_olap');
        }

    } catch (err) {
        console.error('Error during test:', err);
    }
}

test();
