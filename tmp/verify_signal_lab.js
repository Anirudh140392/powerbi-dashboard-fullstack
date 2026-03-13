
import { getSignalLabData } from '../backend/src/controllers/availabilityAnalysisController.js';

const mockReq = {
    query: {
        platform: 'All',
        brand: 'All',
        startDate: '2025-10-01',
        endDate: '2025-10-31',
        type: 'availability',
        signalType: 'drainer',
        page: 1,
        limit: 4
    }
};

const mockRes = {
    json: (data) => {
        console.log('✅ API Response received');
        console.log('Total Count:', data.totalCount);
        if (data.skus && data.skus.length > 0) {
            const firstSku = data.skus[0];
            console.log('--- Sample SKU ---');
            console.log('SKU Name:', firstSku.skuName);
            console.log('SKU Code:', firstSku.skuCode);
            console.log('Offtake Value:', firstSku.offtakeValue);
            console.log('Offtake Share:', firstSku.offtakeShare);
            if (firstSku.topCities && firstSku.topCities.length > 0) {
                console.log('--- Top Cities ---');
                firstSku.topCities.forEach((c, idx) => {
                    console.log(`${idx + 1}. ${c.city} | ${c.metric} | ${c.weightage}`);
                });
            }
        } else {
            console.log('⚠️ No SKUs returned. Check filters or DB data.');
        }
    },
    status: (code) => ({
        json: (err) => console.error(`❌ Error ${code}:`, err)
    })
};

async function runTest() {
    console.log('🚀 Starting Signal Lab Verification...');
    try {
        // Set env vars for ClickHouse
        process.env.CLICKHOUSE_URL = 'http://13.200.55.131:8123';
        process.env.CLICKHOUSE_USER = 'readonly_user';
        process.env.CLICKHOUSE_PASSWORD = 'Readonly@123';
        process.env.CLICKHOUSE_DB = 'mars';
        
        await getSignalLabData(mockReq, mockRes);
    } catch (err) {
        console.error('🔥 Test Failed:', err);
    }
}

runTest();
