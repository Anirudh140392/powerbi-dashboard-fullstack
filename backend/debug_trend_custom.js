
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
            platform: 'Zepto',
            period: 'Custom',
            timeStep: 'Daily',
            startDate: '2025-11-01',
            endDate: '2025-11-15'
        };

        console.log('Testing getTrendData with Custom filters:', filters);
        const result = await watchTowerService.getTrendData(filters);

        console.log(`Returned ${result.timeSeries.length} data points.`);
        if (result.timeSeries.length > 0) {
            console.log('First point:', result.timeSeries[0]);
            console.log('Last point:', result.timeSeries[result.timeSeries.length - 1]);
        } else {
            console.log('No data found.');
        }

        // Check sample record
        const sample = await sequelize.query(
            `SELECT * FROM rb_pdp_olap WHERE Brand LIKE '%Aer%' AND LOWER(Location) = 'agra' AND LOWER(Platform) = 'zepto' LIMIT 1`,
            { type: sequelize.QueryTypes.SELECT }
        );
        console.log('Sample Record DATE:', sample[0]?.DATE);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
};

check();
