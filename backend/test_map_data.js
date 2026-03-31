import mapIntellectService from './src/services/mapIntellectService.js';

async function testMap() {
    try {
        const res = await mapIntellectService.getMapIntellectData({ platform: 'Blinkit', metric: 'osa', months: 1 });
        console.log('Result cities count:', res.cities.length);
        if (res.cities.length > 0) {
            console.log('Sample city:', res.cities[0]);
        }
    } catch (e) {
        console.error('Full Error:', e);
    }
}
testMap();
