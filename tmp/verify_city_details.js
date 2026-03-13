
import { getCityDetailsForProduct } from '../backend/src/controllers/availabilityAnalysisController.js';

const mockReq = {
    query: {
        webPid: '480030', // Sample Web_Pid from previous output
        platform: 'All',
        brand: 'All',
        startDate: '2025-12-01',
        endDate: '2025-12-31',
        type: 'availability',
        signalType: 'drainer'
    }
};

const mockRes = {
    json: (data) => {
        console.log('✅ City Details Response received');
        console.log('Total Cities:', data.cities?.length);
        if (data.cities && data.cities.length > 0) {
            console.log('--- Sample City ---');
            console.log(JSON.stringify(data.cities[0], null, 2));
        } else {
            console.log('⚠️ No cities returned.');
        }
    },
    status: (code) => ({
        json: (err) => console.error(`❌ Error ${code}:`, err)
    })
};

async function runTest() {
    console.log('🚀 Starting Signal Lab City Details Verification...');
    try {
        process.env.CLICKHOUSE_URL = 'http://13.200.55.131:8123';
        process.env.CLICKHOUSE_USER = 'readonly_user';
        process.env.CLICKHOUSE_PASSWORD = 'Readonly@123';
        process.env.CLICKHOUSE_DB = 'mars';
        
        await getCityDetailsForProduct(mockReq, mockRes);
    } catch (err) {
        console.error('🔥 Test Failed:', err);
    }
}

runTest();
