import mapIntellectService from './src/services/mapIntellectService.js';

async function testMap() {
    try {
        await mapIntellectService.getMapIntellectData({ platform: 'Blinkit', metric: 'osa', months: 1 });
    } catch (e) {
        console.log('--- ERROR START ---');
        console.log(String(e));
        if (e.message) console.log('Message:', e.message);
        console.log('--- ERROR END ---');
    }
}
testMap();
