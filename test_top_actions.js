import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
});

async function testTopActions() {
    try {
        console.log('Testing Top Actions API...');
        const response = await api.get('/watchtower/top-actions', {
            params: {
                platform: 'Zepto',
                endDate: '2024-12-31'
            }
        });
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testTopActions();
