import { getSignalLabData } from './src/controllers/availabilityAnalysisController.js';
import { connectClickHouse, asyncStorageMiddleware } from './src/config/clickhouse.js';

async function test() {
    await connectClickHouse();
    const req = {
        query: {
            type: 'visibility',
            signalType: 'drainer',
            page: 1,
            limit: 5,
            groupBy: 'brand'
        }
    };
    const res = {
        json: (data) => console.log("SUCCESS:", JSON.stringify(data).slice(0, 100) + '...'),
        status: (code) => {
            console.log('STATUS:', code);
            return { json: (data) => console.log('ERROR JSON:', data) };
        }
    };
    asyncStorageMiddleware(req, res, async () => {
        try {
            await getSignalLabData(req, res);
            process.exit(0);
        } catch(e) {
            console.log("UNCAUGHT ERRR:", e);
        }
    });
}
test().catch(console.error);
