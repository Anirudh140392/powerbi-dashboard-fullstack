import visibilityService from './src/services/visibilityService.js';
import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'fs';

const dbStorage = new AsyncLocalStorage();

async function reproduce() {
    const db = 'mars';
    const results = { db };
    
    const context = { dbName: db };
    
    await dbStorage.run(context, async () => {
        try {
            const filtersZepto = {
                platform: 'Zepto',
                location: 'All',
                format: 'All',
                brand: 'All',
                period: '1M'
            };
            const dataZepto = await visibilityService.getVisibilityCompetition(filtersZepto);
            results.zepto = {
                brands_count: dataZepto.brands?.length || 0,
                skus_count: dataZepto.skus?.length || 0,
                sample_brands: dataZepto.brands?.slice(0, 3).map(b => b.brand) || []
            };

            const filtersBlinkit = {
                platform: 'Blinkit',
                location: 'All',
                format: 'All',
                brand: 'All',
                period: '1M'
            };
            const dataBlinkit = await visibilityService.getVisibilityCompetition(filtersBlinkit);
            results.blinkit = {
                brands_count: dataBlinkit.brands?.length || 0,
                skus_count: dataBlinkit.skus?.length || 0
            };

        } catch (error) {
            results.error = error.message;
        }
    });

    fs.writeFileSync('reproduction_results.json', JSON.stringify(results, null, 2));
    console.log('Results written to reproduction_results.json');
    process.exit(0);
}

reproduce();
