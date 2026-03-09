
import 'dotenv/config';
import watchTowerService from './src/services/watchTowerService.js';
import sequelize from './src/config/db.js';
import { Op } from 'sequelize';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import dayjs from 'dayjs';

// Mock getAvailability and getShareOfSearch if needed, or import them if exported.
// Since they are not exported directly, I will use the service's internal logic or try to call getSummaryMetrics and inspect the logs/results.
// But better to query the raw data first to see if it exists.

const check = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const brand = 'Aer';
        const location = 'Agra';
        const platform = 'Zepto';
        const compareStart = '2025-10-01';
        const compareEnd = '2025-10-31';

        console.log(`Checking data for Compare Period: ${compareStart} to ${compareEnd}`);

        // 1. Check Raw Availability Data (Neno/Deno)
        const availabilityData = await RbPdpOlap.findAll({
            attributes: [
                [sequelize.fn('SUM', sequelize.col('neno_osa')), 'total_neno'],
                [sequelize.fn('SUM', sequelize.col('deno_osa')), 'total_deno']
            ],
            where: {
                DATE: { [Op.between]: [compareStart, compareEnd] },
                Brand: { [Op.like]: `%${brand}%` },
                Location: location,
                Platform: platform
            },
            raw: true
        });
        console.log('Raw Availability Data (Oct 1-31):', availabilityData);

        const neno = parseFloat(availabilityData[0].total_neno || 0);
        const deno = parseFloat(availabilityData[0].total_deno || 0);
        const availability = deno > 0 ? (neno / deno) * 100 : 0;
        console.log(`Calculated Availability: ${availability}%`);

        // 2. Check Raw Share of Search Data
        // SOS logic usually involves RbKw or similar. Let's check watchTowerService logic.
        // It calls getShareOfSearch. Since I can't import it easily, I'll use getSummaryMetrics with just the compare dates as the main dates to see what it returns.

        const filters = {
            brand: brand,
            location: location,
            startDate: compareStart,
            endDate: compareEnd,
            platform: platform
        };

        console.log('\nCalling getSummaryMetrics for Oct 1-31 (as main period) to check calculated values:');
        const result = await watchTowerService.getSummaryMetrics(filters);

        const sosMetric = result.topMetrics.find(m => m.name === 'Share of Search');
        const availMetric = result.topMetrics.find(m => m.name === 'Availability');

        console.log(`Service returned Availability: ${availMetric.label}`);
        console.log(`Service returned SOS: ${sosMetric.label}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
};

check();
