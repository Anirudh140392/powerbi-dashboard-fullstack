import axios from 'axios';

async function testCompetitionData() {
    try {
        console.log('Testing /api/watchtower/competition-data for pricing...');
        const response = await axios.get('http://localhost:5000/api/watchtower/competition-data', {
            params: {
                platform: 'Blinkit',
                location: 'Ahmedabad',
                category: 'All',
                period: '1M'
            }
        });

        console.log('Status:', response.status);
        if (response.data.brands && response.data.brands.length > 0) {
            const firstBrand = response.data.brands[0];
            console.log('First brand:', firstBrand.brand_name);
            console.log(' - Discount:', firstBrand.Discount);
            console.log(' - PricePerUnit:', firstBrand.PricePerUnit);
            console.log(' - ASP:', firstBrand.ASP);
            console.log(' - RPI:', firstBrand.RPI);

            const hasPricing = ('Discount' in firstBrand) && ('PricePerUnit' in firstBrand);
            console.log('\nPricing metrics present:', hasPricing ? 'YES' : 'NO');
        } else {
            console.log('No brands data returned.');
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testCompetitionData();
