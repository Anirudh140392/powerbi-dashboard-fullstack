import { connectClickHouse } from './src/config/clickhouse.js';
import mapIntellectService from './src/services/mapIntellectService.js';

async function test() {
    console.log('Connecting to ClickHouse...');
    const connected = await connectClickHouse();
    if (!connected) { console.error('Failed to connect'); process.exit(1); }
    console.log('Testing MapIntellect Service with All platforms...');
    try {
        const data = await mapIntellectService.getMapIntellectData({
            platform: 'All',
            months: 1,
            metric: 'all'
        });
        console.log(`Success! Received data for ${data.cities.length} cities.`);
        if (data.cities.length > 0) {
            console.log('Sample city names:', data.cities.slice(0, 10).map(c => c.name));
            console.log('Full first city:', JSON.stringify(data.cities[0], null, 2));
        }
    } catch (e) {
        console.error('Test Failed:', e);
    }
    process.exit(0);
}

test();
