import 'dotenv/config';
import inventoryAnalysisService from './src/services/inventoryAnalysisService.js';

async function debugMatrix() {
    try {
        console.log('--- Debugging getCitySkuMatrix (Snake Case) ---');
        const filters = {
            platform: 'All',
            brand: 'All',
            location: 'All'
        };
        const response = await inventoryAnalysisService.getCitySkuMatrix(filters);
        const puneRows = response.data.filter(r => r.city === 'Pune');

        console.log('Total Pune rows:', puneRows.length);
        if (puneRows.length > 0) {
            console.log('Sample Pune Row:', puneRows[0]);
        }
    } catch (err) {
        console.error(err);
    }
}

debugMatrix();
