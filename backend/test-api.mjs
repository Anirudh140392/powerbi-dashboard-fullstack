import axios from 'axios';

async function test() {
    try {
        const res = await axios.get('http://127.0.0.1:5000/api/watchtower/kpi-trends', {
            params: {
                platform: 'Blinkit',
                location: 'All',
                brand: 'All',
                category: 'All',
                period: '1Y',
                timeStep: 'Daily'
            }
        });
        console.log(`Length: ${res.data.timeSeries?.length}`);
        console.log("All dates:", res.data.timeSeries.map(p => p.date).join(', '));
    } catch (e) {
        console.error('API Error:', e.response?.data || e.message);
    }
}

test();
