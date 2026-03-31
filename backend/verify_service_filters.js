import visibilityService from './src/services/visibilityService.js';
import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';

const dbStorage = new AsyncLocalStorage();

async function verifyServiceFilters() {
    console.log('Verifying Competition Filter Options (Direct Service Call)...');
    
    const context = { dbName: process.env.CLICKHOUSE_DB || 'mars' };
    
    await dbStorage.run(context, async () => {
        try {
            // 1. Test brands for Instamart
            console.log('\n--- Test 1: Brands for Instamart ---');
            const resBrandsInstamart = await visibilityService.getVisibilityFilterOptions({
                filterType: 'brands',
                platform: 'Instamart'
            });
            console.log('Instamart brands count:', resBrandsInstamart.options?.length);
            if (resBrandsInstamart.options?.length > 0) {
                console.log('Sample brands:', resBrandsInstamart.options.slice(0, 5));
            }

            // 2. Test brands for Zepto
            console.log('\n--- Test 2: Brands for Zepto ---');
            const resBrandsZepto = await visibilityService.getVisibilityFilterOptions({
                filterType: 'brands',
                platform: 'Zepto'
            });
            console.log('Zepto brands count:', resBrandsZepto.options?.length);

            // 3. Test formats (Categories) for Instamart
            console.log('\n--- Test 3: Formats for Instamart ---');
            const resFormatsInstamart = await visibilityService.getVisibilityFilterOptions({
                filterType: 'formats',
                platform: 'Instamart'
            });
            console.log('Instamart formats count:', resFormatsInstamart.options?.length);
            if (resFormatsInstamart.options?.length > 0) {
                console.log('Formats:', resFormatsInstamart.options);
            }

            // 4. Test cascading: SKUs for a specific brand on Instamart
            console.log('\n--- Test 4: SKUs for Cadbury on Instamart ---');
            if (resBrandsInstamart.options?.length > 0) {
                const brand = resBrandsInstamart.options[0];
                const resSkus = await visibilityService.getVisibilityFilterOptions({
                    filterType: 'skus',
                    platform: 'Instamart',
                    brand: brand
                });
                console.log(`SKUs for ${brand} on Instamart count:`, resSkus.options?.length);
            }

            console.log('\n✅ Direct Service Filter Verification Complete.');
        } catch (error) {
            console.error('Error during verification:', error.message);
        }
    });

    process.exit(0);
}

verifyServiceFilters();
