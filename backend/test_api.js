
import axios from 'axios';

async function testApi() {
    try {
        const res = await axios.get('http://localhost:3000/api/ecom-offtake', {
            params: {
                platform: 'Instamart',
                month: '2026-03-01'
            }
        });
        console.log("API Success:", res.data.currFormatted, res.data.prevFormatted);
    } catch (err) {
        console.error("API Failed with status:", err.response?.status);
        console.error("Error data:", JSON.stringify(err.response?.data, null, 2));
    }
}

testApi();
