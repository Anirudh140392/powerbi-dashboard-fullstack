import visibilityService from './visibilityService.js';
import { connectClickHouse } from '../config/clickhouse.js';

async function verify() {
    try {
        console.error('--- STARTING VERIFICATION ---');
        const connected = await connectClickHouse();
        if (!connected) {
            console.error('❌ Failed to connect to ClickHouse');
            process.exit(1);
        }
        
        console.error('--- Verifying getVisibilityKeywords ---');
        
        const allKeywords = await visibilityService.getVisibilityKeywords('Amazon', 'All', 'All', false);
        console.error('All Keywords count:', allKeywords.length);
        
        const myKeywords = await visibilityService.getVisibilityKeywords('Amazon', 'All', 'All', true);
        console.error('My Keywords count:', myKeywords.length);
        
        if (myKeywords.length > 0 && myKeywords.length < allKeywords.length) {
            console.error('✅ SUCCESS: My Keywords are filtered correctly.');
        } else if (myKeywords.length === 0) {
            console.error('⚠️ WARNING: No My Keywords found. Check if flag=1 exists for Amazon.');
        } else {
            console.error('❌ FAILURE: My Keywords are NOT filtered or there are no other brands.');
        }

        console.error('\n--- Verifying getVisibilityFilterOptions (SKUs) ---');
        const allSkus = await visibilityService.getVisibilityFilterOptions({
            filterType: 'skus',
            platform: 'Amazon'
        });
        console.error('All SKUs count:', allSkus.options.length);
        
        const mySkus = await visibilityService.getVisibilityFilterOptions({
            filterType: 'skus',
            platform: 'Amazon',
            ownBrandsOnly: true
        });
        console.error('My SKUs count:', mySkus.options.length);
        
        if (mySkus.options.length > 0 && mySkus.options.length < allSkus.options.length) {
            console.error('✅ SUCCESS: My SKUs are filtered correctly.');
        } else if (mySkus.options.length === 0) {
            console.error('⚠️ WARNING: No My SKUs found. Check if flag=1 exists for Amazon.');
        } else {
            console.error('❌ FAILURE: My SKUs are NOT filtered or there are no other brands.');
        }

        console.error('--- VERIFICATION COMPLETE ---');
        process.exit(0);
    } catch (error) {
        console.error('Verification failed with error:', error);
        process.exit(1);
    }
}

verify();
