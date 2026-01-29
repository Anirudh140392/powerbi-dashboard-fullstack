import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';

async function test() {
    try {
        const filters = {
            platform: 'Blinkit',
            endDate: '2026-01-27'
        };

        console.log('Testing getTopActions (NCR specific)...');
        const result = await watchTowerService.getTopActions(filters);

        console.log('Counts:', result.counts);
        console.log('Metadata:', result.metadata);

        if (result.counts.darkstoreCount > 0 && result.counts.skuCount > 0) {
            console.log('✅ SUCCESS: Non-zero counts returned.');
        } else {
            console.log('❌ FAILURE: Counts are still 0.');
            console.log('Note: If this is 0, check if Jan 19-27 data exists for NCR in ColPal DB.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}
test();
