import watchTowerService from './src/services/watchTowerService.js';

async function debugBlinkit() {
    try {
        console.log('--- Debugging Competition Data for Blinkit ---');
        const res = await watchTowerService.getCompetitionData({
            platform: 'Blinkit',
            location: 'All',
            category: 'All',
            period: '1M'
        });

        console.log('\nReturned Brands Count:', res.brands ? res.brands.length : 0);
        (res.brands || []).forEach(b => {
            console.log(`Brand: "${b.brand_name}" | OfftakeShare:`, b.OfftakeShare, '| MarketShare:', b.MarketShare, '| CategoryShare:', b.CategoryShare);
        });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

debugBlinkit();
