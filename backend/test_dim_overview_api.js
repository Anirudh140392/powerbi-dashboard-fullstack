import axios from 'axios';

async function testDimensionOverview() {
    try {
        console.log('Testing /api/pricing-analysis/dimension-overview...');
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEB0cmFpbHl0aWNzLmNvbSIsInVzZXJOYW1lIjoiVGVzdCBVc2VyIiwiZGJOYW1lIjoibWFycyIsImlhdCI6MTc3NDY4NjYxNSwiZXhwIjoxNzc0NzczMDE5fQ.6T91vbnBPc0ylapUOn4Re9t2zor5l3GpppTC56LbMhgw';
        const response = await axios.get('http://localhost:5000/api/pricing-analysis/dimension-overview', {
            params: {
                platform: 'Blinkit',
                startDate: '2026-03-01',
                endDate: '2026-03-28',
                dimension: 'platform'
            },
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log('Status:', response.status);
        console.log('Success:', response.data.success);
        if (response.data.data && response.data.data.length > 0) {
            console.log('Results count:', response.data.data.length);
            console.log('First entity:', response.data.data[0].name);
            console.log('Data:', JSON.stringify(response.data.data[0].data, null, 2));
        } else {
            console.log('No data returned.');
            if (response.data.error) console.log('Error from API:', response.data.error);
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testDimensionOverview();
