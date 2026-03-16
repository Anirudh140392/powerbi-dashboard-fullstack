import mapIntellectService from './backend/src/services/mapIntellectService.js';

async function test() {
    try {
        const filters = { platform: 'Blinkit', months: 1 };
        console.log('Testing with filters:', filters);
        const data = await mapIntellectService.getMapIntellectData(filters);
        console.log('Result Cities Count:', data.cities.length);
        if (data.cities.length > 0) {
            console.log('First city sample:', data.cities[0]);
        } else {
            console.log('No cities found in response');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

test();
