import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

async function testVisibility() {
    try {
        console.log('--- Testing Visibility Signals ---');
        const signalsRes = await axios.get(`${BASE_URL}/visibility-analysis/visibility-signals`, {
            params: {
                level: 'keyword',
                signalType: 'drainer',
                platform: 'Blinkit',
                startDate: '2024-03-01',
                endDate: '2024-03-15'
            }
        });
        
        console.log('Signals Count:', signalsRes.data.signals?.length);
        if (signalsRes.data.signals?.length > 0) {
            const first = signalsRes.data.signals[0];
            console.log('First Signal:', first.keyword || first.skuName, 'Impact:', first.impact, 'MetricType:', first.metricType);
            
            console.log('\n--- Testing City Details ---');
            const cityRes = await axios.get(`${BASE_URL}/visibility-analysis/visibility-signals/city-details`, {
                params: {
                    keyword: first.keyword,
                    level: 'keyword',
                    platform: 'Blinkit',
                    startDate: '2024-03-01',
                    endDate: '2024-03-15'
                }
            });
            console.log('Cities Count:', cityRes.data.cities?.length);
            if (cityRes.data.cities?.length > 0) {
                console.log('First City:', cityRes.data.cities[0]);
            }
        } else {
            console.log('No signals found for the given dates.');
        }

    } catch (error) {
        console.error('Test Failed:', error.response?.data || error.message);
    }
}

testVisibility();
