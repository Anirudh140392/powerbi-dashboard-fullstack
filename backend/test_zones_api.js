import axios from 'axios';

async function testZonesApi() {
    try {
        const response = await axios.get('http://localhost:5000/api/performance-marketing/zones');
        console.log("API STATUS:", response.status);
        console.log("API DATA:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("API ERROR:", error.message);
    }
}

testZonesApi();
