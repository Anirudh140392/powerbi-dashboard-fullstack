import { connectClickHouse } from './src/config/clickhouse.js';
import mapIntellectService from './src/services/mapIntellectService.js';

async function test() {
    console.log('Connecting to ClickHouse...');
    const connected = await connectClickHouse();
    if (!connected) { console.error('Failed to connect'); process.exit(1); }
    console.log('Testing MapIntellect Service locations with Blinkit...');
    try {
        const data = await mapIntellectService.getMapIntellectData({
            platform: 'Blinkit',
            months: 1,
            metric: 'all'
        });
        console.log(`Received data for ${data.cities.length} cities.`);
        const names = data.cities.map(c => c.name);
        console.log('Locations returned:', names.slice(0, 30).join(', '));
    } catch (e) {
        console.error('Test Failed:', e);
    }
    process.exit(0);
}

test();
