
import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';

const testFuzzyMatch = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');

        // Test Zepto with "Aer"
        console.log('--- Testing Zepto with Aer ---');
        const zeptoFilters = {
            months: 6,
            platform: 'Zepto',
            category: 'All',
            brandsOverviewPlatform: 'Zepto',
            brandsOverviewCategory: 'All',
            brand: 'Aer', // User selected Aer
            location: 'All'
        };
        const zeptoResult = await watchTowerService.getSummaryMetrics(zeptoFilters);

        if (zeptoResult.brandsOverview) {
            const aerBrand = zeptoResult.brandsOverview.find(b => b.label.toLowerCase().includes('aer'));
            if (aerBrand) {
                console.log('Aer Brand Found:', aerBrand.label);
                console.log('Aer Columns:', JSON.stringify(aerBrand.columns, null, 2));
            } else {
                console.log('Aer brand NOT found in result.');
            }
        } else {
            console.log('No brandsOverview in result.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
};

testFuzzyMatch();
