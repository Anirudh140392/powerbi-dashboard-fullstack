import axios from 'axios';

async function testPricingTrends() {
    try {
        console.log('Testing /api/watchtower/kpi-trends for pricing...');
        const response = await axios.get('http://localhost:5000/api/watchtower/kpi-trends', {
            params: {
                platform: 'Blinkit',
                location: 'Ahmedabad',
                category: 'All',
                period: '1M',
                timeStep: 'Daily'
            }
        });

        console.log('Status:', response.status);
        if (response.data.timeSeries && response.data.timeSeries.length > 0) {
            const firstPoint = response.data.timeSeries[0];
            console.log('First point metrics:');
            console.log(' - Discount:', firstPoint.Discount);
            console.log(' - PricePerUnit:', firstPoint.PricePerUnit);
            console.log(' - ASP:', firstPoint.ASP);
            console.log(' - RPI:', firstPoint.RPI);

            const hasPricing = ('Discount' in firstPoint) && ('PricePerUnit' in firstPoint);
            console.log('\nPricing metrics present:', hasPricing ? 'YES' : 'NO');
        } else {
            console.log('No timeSeries data returned.');
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testPricingTrends();
