import axios from 'axios';

const API_URL = 'http://localhost:5000/api/watchtower';

async function testEndpoints() {
    try {
        console.log('Testing /summary...');
        const summary = await axios.get(`${API_URL}/summary`);
        console.log('✅ Summary:', summary.data);

        console.log('\nTesting /platform-overview...');
        const platforms = await axios.get(`${API_URL}/platform-overview`);
        console.log('✅ Platforms:', platforms.data.length, 'platforms found');

        console.log('\nTesting /trends...');
        const trends = await axios.get(`${API_URL}/trends`);
        console.log('✅ Trends:', trends.data);

    } catch (error) {
        console.error('❌ API Test Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testEndpoints();
