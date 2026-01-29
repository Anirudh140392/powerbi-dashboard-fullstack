import axios from 'axios';

async function test() {
    try {
        const url = 'http://localhost:5000/api/watchtower/top-actions';
        const params = {
            platform: 'Zepto',
            endDate: '2026-01-27'
        };
        console.log(`Calling ${url} with`, params);
        const res = await axios.get(url, { params });
        console.log('Response status:', res.status);
        console.log('Response data:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('API Error:', e.message);
        if (e.response) {
            console.error('Response data:', e.response.data);
        }
    }
}
test();
