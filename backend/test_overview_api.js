import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/watchtower';

async function testEndpoint(name, path, params = {}) {
    console.log(`\n--- Testing ${name} (${path}) ---`);
    try {
        const res = await axios.get(`${BASE_URL}${path}`, { params });
        console.log(`Status: ${res.status}`);
        if (Array.isArray(res.data)) {
            console.log(`Count: ${res.data.length}`);
            if (res.data.length > 0) {
                console.log('Sample data keys:', Object.keys(res.data[0]));
                console.log('Sample data values:', res.data[0]);
            }
        } else {
            console.log('Response is not an array:', typeof res.data);
            console.log('Data:', res.data);
        }
    } catch (err) {
        console.error(`Error testing ${name}:`, err.response?.data || err.message);
    }
}

async function runTests() {
    // 1. Test Platform Overview
    await testEndpoint('Platform Overview', '/platform-overview');

    // 2. Test Brand Overview
    await testEndpoint('Brand Overview', '/brands-overview');

    // 3. Test Category Overview
    await testEndpoint('Category Overview', '/category-overview');

    // 4. Test Month Overview
    await testEndpoint('Month Overview', '/month-overview');

    // 5. Test SKU Overview
    await testEndpoint('SKU Overview', '/sku-overview');

    // 6. Test Multi-select Filters
    await testEndpoint('Multi-Platform Filter', '/platform-overview', { platform: 'Blinkit,Zepto' });
    await testEndpoint('Multi-Category Filter', '/platform-overview', { category: 'CUP,CONE' });
}

runTests();
