import visibilityService from './src/services/visibilityService.js';

async function test() {
    try {
        // Use a generic keyword where multiple brands compete
        const keyword = 'face mask';
        const brand = 'mamaearth';

        const filtersAll = {
            platform: 'blinkit',
            brand,
            keyword,
            startDate: '2026-06-01',
            endDate: '2026-06-01',
            viewMode: 'keyword',
            rank: 'All'
        };

        const filtersRank10 = {
            platform: 'blinkit',
            brand,
            keyword,
            startDate: '2026-06-01',
            endDate: '2026-06-01',
            viewMode: 'keyword',
            rank: 'Top 10'
        };

        console.log(`=== Testing keyword: "${keyword}", brand: "${brand}" ===\n`);

        console.log('--- Rank: All ---');
        const resAll = await visibilityService.getSearchTermsLocationDrilldown(filtersAll);
        console.log('Locations count:', resAll.locations.length);
        
        console.log('\n--- Rank: Top 10 ---');
        const resRank10 = await visibilityService.getSearchTermsLocationDrilldown(filtersRank10);
        console.log('Locations count:', resRank10.locations.length);

        // Compare side by side
        console.log('\n=== Side-by-side Comparison ===');
        console.log('City'.padEnd(15), 'All_SOS'.padEnd(10), 'Top10_SOS'.padEnd(10), 'All_Rank'.padEnd(10), 'Top10_Rank'.padEnd(10), 'SOS_Changed?');
        console.log('-'.repeat(70));
        
        const allMap = {};
        resAll.locations.forEach(l => { allMap[l.city] = l; });
        
        const allCities = new Set([
            ...resAll.locations.map(l => l.city),
            ...resRank10.locations.map(l => l.city)
        ]);
        
        for (const city of allCities) {
            const a = allMap[city] || { overallSOS: '-', overallRank: '-' };
            const r = resRank10.locations.find(l => l.city === city) || { overallSOS: '-', overallRank: '-' };
            const changed = a.overallSOS !== r.overallSOS ? '✅ YES' : '❌ NO';
            console.log(
                String(city).padEnd(15),
                String(a.overallSOS).padEnd(10),
                String(r.overallSOS).padEnd(10),
                String(a.overallRank).padEnd(10),
                String(r.overallRank).padEnd(10),
                changed
            );
        }
    } catch (error) {
        console.error('Error in test:', error);
    }
    process.exit(0);
}

test();
