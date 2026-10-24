import mongoose from 'mongoose';
import dayjs from 'dayjs';
import * as watchTowerService from './src/services/watchTowerService.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        const filters = {
            startDate: '2024-05-01',
            endDate: dayjs().format('YYYY-MM-DD'),
            platform: 'Blinkit',
            brand: 'Neno',
            timeStep: 'Monthly'
        };

        console.log('Testing watchTowerService.computeSummaryMetrics...');
        const result = await watchTowerService.computeSummaryMetrics(filters);

        console.log('Success! Extracted performanceMetricsKpis:');
        console.log(JSON.stringify(result.performanceMetricsKpis, null, 2));

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        process.exit();
    }
}

test();
