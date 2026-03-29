import { getEcomRcaData } from './src/services/ecomRcaService.js';
import mongoose from 'mongoose';

async function run() {
    try {
        console.log("Mocking mongoose to prevent connection hang...");
        mongoose.connect = async () => console.log("Mongoose connect mocked.");

        const filters = {
            platform: 'All',
            category: 'All',
            brand: 'boat',
            drilldownLevel: 'keyword',
            drilldownId: 'boat',
            kpiCategory: 'visibility',
            activeTab: 'gainers',
            startDate: '2026-03-01',
            endDate: '2026-03-29'
        };
        const result = await getEcomRcaData(filters);
        console.log(JSON.stringify(result.rows.slice(0, 3), null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
