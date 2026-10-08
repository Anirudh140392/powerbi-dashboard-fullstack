
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
            period: '3M',
            timeStep: 'Weekly'
        };

        console.log('Testing getTrendData with filters:', filters);
        const result = await watchTowerService.getTrendData(filters);

        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
};

check();
