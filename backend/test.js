import mapIntellectService from './src/services/mapIntellectService.js';

async function test() {
    console.log('Testing MapIntellect Service directly...');
    try {
        const data = await mapIntellectService.getMapIntellectData({
            platform: 'Blinkit',
            months: 1,
            metric: 'marketshare'
        });
        console.log(`Success! Received data for ${data.cities.length} cities.`);
        if (data.cities.length > 0) {
            console.log('Sample city:', JSON.stringify(data.cities[0], null, 2));
        }
    } catch (e) {
        console.error('Test Failed:', e);
    }
    process.exit(0);
}

test();
