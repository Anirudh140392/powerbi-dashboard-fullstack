
import axios from 'axios';

const testApiWithFilters = async () => {
    try {
        console.log("Testing API with filters...");

        // 1. No filters
        console.log("1. No filters:");
        const res1 = await axios.get('http://localhost:5000/api/content-analysis');
        console.log(`   Status: ${res1.status}, Count: ${res1.data.length}`);

        // 2. With Platform filter
        console.log("2. Platform='Amazon':");
        const res2 = await axios.get('http://localhost:5000/api/content-analysis?platform=Amazon');
        console.log(`   Status: ${res2.status}, Count: ${res2.data.length}`);

        // 3. With Brand filter (that likely doesn't exist to check robustness)
        console.log("3. Brand='NonExistentBrand':");
        const res3 = await axios.get('http://localhost:5000/api/content-analysis?brand=NonExistentBrand');
        console.log(`   Status: ${res3.status}, Count: ${res3.data.length}`);

    } catch (error) {
        console.error("❌ API Test Failed:", error.message);
        if (error.response) {
            console.error("Data:", error.response.data);
        }
    }
};

testApiWithFilters();
