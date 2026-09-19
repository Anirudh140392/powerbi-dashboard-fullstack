
import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';

const check = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const testCases = [
            { period: '1M', timeStep: 'Daily' },
            { period: '3M', timeStep: 'Weekly' },
            { period: '6M', timeStep: 'Monthly' },
            { period: '1Y', timeStep: 'Monthly' }
        ];

        for (const test of testCases) {
            console.log(`\n--- Testing ${test.period} / ${test.timeStep} ---`);
            const filters = {
                brand: 'Aer',
                location: 'Agra',
                platform: 'Zepto',
                period: test.period,
                timeStep: test.timeStep
            };

            const result = await watchTowerService.getTrendData(filters);
            console.log(`Returned ${result.timeSeries.length} data points.`);
            if (result.timeSeries.length > 0) {
                console.log('First point:', result.timeSeries[0]);
                console.log('Last point:', result.timeSeries[result.timeSeries.length - 1]);
            } else {
                console.log('No data found.');
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
};

check();
