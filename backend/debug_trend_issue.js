
import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';
import { Op } from 'sequelize';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import dayjs from 'dayjs';

const check = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const filters = {
            brand: 'Aer',
            location: 'Agra',
            startDate: '2025-08-01',
            endDate: '2025-12-05',
            compareStartDate: '2025-09-01',
            compareEndDate: '2025-09-06',
            platform: 'Zepto'
        };

        console.log('1. Calling getSummaryMetrics with filters:', filters);
        const result = await watchTowerService.getSummaryMetrics(filters);

        console.log('\n2. Top Metrics Results from Service:');
        result.topMetrics.forEach(m => {
            console.log(`Metric: ${m.name}`);
            console.log(`  Current: ${m.label}`);
            console.log(`  Trend: ${m.trend}`);
            console.log(`  Trend Type: ${m.trendType}`);
        });

        console.log('\n3. Manual Check of Previous Period Data (2025-09-01 to 2025-09-06):');

        // Manual Offtake Query
        const prevOfftake = await RbPdpOlap.sum('Sales', {
            where: {
                DATE: { [Op.between]: ['2025-09-01', '2025-09-06'] },
                Brand: { [Op.like]: '%Aer%' },
                Location: 'Agra',
                Platform: 'Zepto'
            }
        });
        console.log(`  Manual Previous Offtake (Sales): ${prevOfftake}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
};

check();
