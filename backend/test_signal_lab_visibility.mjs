import { getSignalLabData } from './src/controllers/availabilityAnalysisController.js';
import { connectClickHouse } from './src/config/clickhouse.js';
import { asyncStorageMiddleware } from './src/config/clickhouse.js';

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
        json: (data) => console.log(JSON.stringify(data).slice(0, 100) + '...'),
        status: (code) => {
            console.log('STATUS:', code);
            return { json: (data) => console.log('ERROR JSON:', data) };
        }
    };
    asyncStorageMiddleware(req, res, async () => {
        await getSignalLabData(req, res);
        process.exit(0);
    });
}
test();
