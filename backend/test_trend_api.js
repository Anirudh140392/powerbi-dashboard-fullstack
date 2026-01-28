import axios from 'axios';

async function testKpiTrends() {
    try {
        const response = await axios.get('http://localhost:5000/api/availability-analysis/kpi-trends', {
            params: {
                platform: 'Blinkit',
                location: 'All',
                category: 'All',
                period: '1M',
                timeStep: 'Daily'
            }
        });
        console.log('API Status:', response.status);
        console.log('Metrics:', JSON.stringify(response.data.metrics, null, 2));
        console.log('Date Range:', response.data.dateRange);
        console.log('Time Series Sample (first 2):', JSON.stringify(response.data.timeSeries?.slice(0, 2), null, 2));
        console.log('Total Data Points:', response.data.timeSeries?.length);
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
    }
}

testKpiTrends();
