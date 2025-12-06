
import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';

const check = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const filters = {
            brand: 'Aer',
            location: 'Agra',
            startDate: '2025-10-01',
            endDate: '2025-10-06',
            compareStartDate: '2025-09-01',
            compareEndDate: '2025-09-06',
            platform: 'Zepto'
        };

        console.log('Fetching metrics with filters:', filters);

        const result = await watchTowerService.getSummaryMetrics(filters);

        console.log('Top Metrics Results:');
        result.topMetrics.forEach(m => {
            console.log(`Metric: ${m.name}`);
            console.log(`  Current: ${m.label}`);
            console.log(`  Trend: ${m.trend}`);
            console.log(`  Trend Type: ${m.trendType}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
};

check();
