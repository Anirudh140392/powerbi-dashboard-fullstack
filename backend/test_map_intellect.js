import dotenv from 'dotenv';
dotenv.config();
import dayjs from 'dayjs';
import MapIntellectService from './src/services/mapIntellectService.js';

async function testMapIntellect() {
    console.log('--- Testing getMapIntellectData ---');
    try {
        const filters = {
            platform: 'Blinkit',
            startDate: '2026-02-01',
            endDate: '2026-02-28',
            months: 1,
            brand: 'All',
            category: 'All'
        };

        const result = await MapIntellectService.getMapIntellectData(filters);
        console.log(`\nReturned ${result.cities.length} cities.`);
        
        if (result.cities.length > 0) {
            const sortedByMS = [...result.cities].sort((a, b) => b.marketShare - a.marketShare);
            console.log('\nTop 5 Cities by Market Share:');
            console.log(JSON.stringify(sortedByMS.slice(0, 5).map(c => ({
                name: c.name, 
                sales: c.salesFormatted, 
                marketShare: c.marketShare
            })), null, 2));
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
    process.exit(0);
}

testMapIntellect();
