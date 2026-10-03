import axios from 'axios';

async function testApi() {
    try {
        const response = await axios.get('http://localhost:5000/api/pricing-analysis/dimension-overview', {
            params: {
                dimension: 'category',
                startDate: '2026-03-01',
                endDate: '2026-03-07'
            }
        });
        console.log('API Response Structure:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('API Error:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

testApi();
