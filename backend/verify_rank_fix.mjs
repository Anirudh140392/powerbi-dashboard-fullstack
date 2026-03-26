import { VisibilityService } from './src/services/visibilityService.js';

async function verify() {
    const service = new VisibilityService();
    const filters = {
        platform: 'Flipkart',
        viewMode: 'sku',
        startDate: '2026-03-01',
        endDate: '2026-03-11',
        isMamaearth: true
    };

    console.log('Fetching top search terms in SKU mode...');
    const result = await service.getTopSearchTerms(filters);

    if (!result.terms || result.terms.length === 0) {
        console.log('No terms found.');
        return;
    }

    console.log(`Total SKUs returned: ${result.terms.length}`);
    
    const mySkus = result.terms.filter(t => t.topBrand === '1');
    console.log(`My SKUs found: ${mySkus.length}`);

    if (mySkus.length > 0) {
        console.log('Sample My SKU:', mySkus[0].skuName);
        process.exit(0);
    } else {
        console.log('FAIL: No My SKUs found even with flag fix. Check if data exists for these dates.');
        process.exit(1);
    }
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
