import mapIntellectService from './src/services/mapIntellectService.js';

async function verify() {
    process.env.CLICKHOUSE_DB = 'colpal';
    console.log('--- Verifying Backend Fix for colpal ---');

    const filters = { platform: 'Blinkit', months: 1 };

    try {
        const data = await mapIntellectService.getMapIntellectData(filters);
        console.log('Result Period:', data.period);
        console.log('Result Cities Count:', data.cities.length);

        if (data.cities.length > 0) {
            console.log('Top city sample:', data.cities[0]);
            const cityNames = data.cities.map(c => c.name);
            console.log('Cities found:', cityNames.slice(0, 10).join(', '));

            // Check if coordinates would be found for these cities
            const { CITIES } = await import('../frontend/src/pages/GeoAnalysis/indiaData.js');
            const cityMap = new Map(CITIES.map(c => [c.name.toLowerCase(), c]));

            const matched = data.cities.filter(c => cityMap.has(c.name.toLowerCase()));
            console.log(`Successfully mapped ${matched.length}/${data.cities.length} cities to coordinates.`);
        } else {
            console.log('ERROR: NO CITIES FOUND for colpal');
        }
    } catch (error) {
        console.error('Verification failed with error:', error);
    }
}

verify();
