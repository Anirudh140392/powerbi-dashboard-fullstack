
import axios from 'axios';

const testApi = async () => {
    try {
        console.log("Testing http://localhost:5000/api/content-analysis...");
        const response = await axios.get('http://localhost:5000/api/content-analysis');
        console.log(`✅ Success! Status: ${response.status}`);
        console.log(`✅ Records found: ${response.data.length}`);
        if (response.data.length > 0) {
            console.log("Sample Record:", response.data[0]);
        }
    } catch (error) {
        console.error("❌ API Test Failed:", error.message);
        if (error.response) {
            console.error("Data:", error.response.data);
            console.error("Status:", error.response.status);
        }
    }
};

testApi();
