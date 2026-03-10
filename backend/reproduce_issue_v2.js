import visibilityService from './src/services/visibilityService.js';
import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';

const dbStorage = new AsyncLocalStorage();

async function reproduce() {
    const db = 'mars';
    console.log(`--- REPRODUCTION START FOR DB: ${db} ---`);
    
    const context = { dbName: db };
    
    await dbStorage.run(context, async () => {
        try {
            console.log('Testing Zepto...');
            const filtersZepto = {
                platform: 'Zepto',
                location: 'All',
                format: 'All',
                brand: 'All',
                period: '1M'
            };
            const dataZepto = await visibilityService.getVisibilityCompetition(filtersZepto);
            console.log('ZEPTO BRANDS FOUND:', dataZepto.brands?.length);
            console.log('ZEPTO SKUS FOUND:', dataZepto.skus?.length);

            console.log('\nTesting Blinkit...');
            const filtersBlinkit = {
                platform: 'Blinkit',
                location: 'All',
                format: 'All',
                brand: 'All',
                period: '1M'
            };
            const dataBlinkit = await visibilityService.getVisibilityCompetition(filtersBlinkit);
            console.log('BLINKIT BRANDS FOUND:', dataBlinkit.brands?.length);

        } catch (error) {
            console.error('REPRODUCTION ERROR:', error);
        }
    });

    console.log('--- REPRODUCTION END ---');
    process.exit(0);
}

reproduce();
