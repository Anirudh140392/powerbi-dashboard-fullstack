import "dotenv/config";
import axios from "axios";

async function testSignalLab(brand = 'All') {
    const params = {
        platform: 'Blinkit',
        brand: brand,
        location: 'All',
        startDate: '2025-12-01',
        endDate: '2025-12-31',
        compareStartDate: '2025-11-01',
        compareEndDate: '2025-11-30',
        type: 'availability',
        signalType: 'drainer',
        page: 1,
        limit: 10
    };

    console.log(`\nTesting Signal Lab API for ${brand} on Blinkit...`);

    try {
        const response = await axios.get(`http://localhost:5000/api/availability-analysis/signal-lab`, { params });
        const data = response.data;

        console.log("✅ API Success!");
        console.log(`Total Count: ${data.totalCount}`);
        console.log(`SKUs Found: ${data.skus?.length || 0}`);
        if (data.skus?.length > 0) {
            console.log("Sample SKU:", data.skus[0].skuName);
            console.log("Change Metric (OSA Change):", data.skus[0].impact);
        }
    } catch (error) {
        if (error.response) {
            console.error("❌ API Error:", error.response.data);
        } else {
            console.error("❌ Fetch failed:", error.message);
        }
    }
}

async function runTests() {
    await testSignalLab('Aer'); // Check specific brand
    await testSignalLab('All'); // Check user's reported "All" case
}

runTests();
