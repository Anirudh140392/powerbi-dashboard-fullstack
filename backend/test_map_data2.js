import mapIntellectService from './src/services/mapIntellectService.js';

async function testMap() {
    try {
        const res = await mapIntellectService.getMapIntellectData({ platform: 'Blinkit', metric: 'osa', months: 1 });
        console.log('Success!', res.cities.length);
    } catch (e) {
        console.log('Error Message: ' + e.message);
    }
}
testMap();
