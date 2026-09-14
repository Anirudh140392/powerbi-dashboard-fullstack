import visibilityService from './src/services/visibilityService.js';
import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';

const dbStorage = new AsyncLocalStorage();

async function reproduce() {
    const db = 'mars';
    console.log(`Reproducing for DB: ${db}`);
    
    const context = { dbName: db };
    
    await dbStorage.run(context, async () => {
        try {
            // Exact parameters from browser
            const filters = {
                platform: 'Zepto',
                location: 'All', // Browser sent 'All'
                format: 'All',   // Browser sent 'All'
                brand: 'All',    // Browser sent 'All'
                period: '1M'
            };

            console.log('Filters:', filters);
            const data = await visibilityService.getVisibilityCompetition(filters);

            console.log('Response Summary:');
            console.log('Brands found:', data.brands?.length || 0);
            console.log('SKUs found:', data.skus?.length || 0);

            if (data.brands?.length > 0) {
                console.log('First 5 brands:', data.brands.slice(0, 5).map(b => b.brand));
            }

            // Check if Blinkit works too
            const filtersBlinkit = { ...filters, platform: 'Blinkit' };
            const dataBlinkit = await visibilityService.getVisibilityCompetition(filtersBlinkit);
            console.log('\nBlinkit results:');
            console.log('Brands found:', dataBlinkit.brands?.length || 0);

        } catch (error) {
            console.error('Error:', error);
        }
    });

    process.exit(0);
}

reproduce();
