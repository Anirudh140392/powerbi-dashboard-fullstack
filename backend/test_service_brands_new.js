
import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';

const testServiceBrandsNew = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');

        // Test Zepto
        console.log('--- Testing Zepto ---');
        const zeptoFilters = {
            months: 6,
            platform: 'Zepto', // Should trigger new logic
            category: 'All',
            brandsOverviewPlatform: 'Zepto',
            brandsOverviewCategory: 'All',
            brand: 'All',
            location: 'All'
        };
        const zeptoResult = await watchTowerService.getSummaryMetrics(zeptoFilters);
        if (zeptoResult.brandsOverview && zeptoResult.brandsOverview.length > 0) {
            console.log('Zepto Brands Found:', zeptoResult.brandsOverview.length);
            console.log('First Zepto Brand:', zeptoResult.brandsOverview[0].label);
            console.log('First Zepto Brand Columns:', JSON.stringify(zeptoResult.brandsOverview[0].columns, null, 2));
        } else {
            console.log('No Zepto brands found.');
        }

        // Test Blinkit
        console.log('\n--- Testing Blinkit ---');
        const blinkitFilters = {
            months: 6,
            platform: 'Blinkit', // Should trigger new logic
            category: 'All',
            brandsOverviewPlatform: 'Blinkit',
            brandsOverviewCategory: 'All',
            brand: 'All',
            location: 'All'
        };
        const blinkitResult = await watchTowerService.getSummaryMetrics(blinkitFilters);
        if (blinkitResult.brandsOverview && blinkitResult.brandsOverview.length > 0) {
            console.log('Blinkit Brands Found:', blinkitResult.brandsOverview.length);
            console.log('First Blinkit Brand:', blinkitResult.brandsOverview[0].label);
            console.log('First Blinkit Brand Columns:', JSON.stringify(blinkitResult.brandsOverview[0].columns, null, 2));
        } else {
            console.log('No Blinkit brands found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
};

testServiceBrandsNew();
