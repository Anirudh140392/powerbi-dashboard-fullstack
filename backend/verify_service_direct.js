import visibilityService from './src/services/visibilityService.js';
import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';

// Mock AsyncLocalStorage for database context
const dbStorage = new AsyncLocalStorage();

async function verifyService() {
    console.log('Verifying Competition Fix (Direct Service Call)...');
    
    // We need to run this in the store context so getCurrentDbName() works
    // Assuming default is 'mars' or whatever is in .env
    const context = { dbName: process.env.CLICKHOUSE_DB || 'mars' };
    
    await dbStorage.run(context, async () => {
        try {
            const filters = {
                platform: 'Zepto',
                period: '1M'
            };

            const data = await visibilityService.getVisibilityCompetition(filters);

            console.log('Brands found:', data.brands?.length || 0);
            console.log('SKUs found:', data.skus?.length || 0);

            if (data.brands?.length > 0) {
                console.log('Sample Brand:', data.brands[0].brand);
                console.log('Sample Brand SOS:', data.brands[0].overall_sos.value);
            }

            if (data.brands?.length > 0 || data.skus?.length > 0) {
                console.log('✅ Fix Verified: Data is now returning for Competition tab.');
            } else {
                console.log('❌ Fix Failed: Competition tab data is still empty.');
            }
        } catch (error) {
            console.error('Error during verification:', error.message);
        }
    });

    process.exit(0);
}

verifyService();
