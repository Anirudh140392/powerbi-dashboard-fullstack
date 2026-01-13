import { DataTypes, Sequelize } from 'sequelize';
import 'dotenv/config';
import sequelize from './src/config/db.js';
import TbZeptoAdsKeywordData from './src/models/TbZeptoAdsKeywordData.js';
import { Op } from 'sequelize';

async function checkDateRange() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // 1. Get Min/Max Date
        const dateRange = await TbZeptoAdsKeywordData.findOne({
            attributes: [
                [sequelize.fn('MIN', sequelize.col('date')), 'minDate'],
                [sequelize.fn('MAX', sequelize.col('date')), 'maxDate']
            ],
            raw: true
        });
        console.log(`Available Data Range: ${dateRange.minDate} to ${dateRange.maxDate}`);

        // 2. Check User's Specific Range (2025-11-04 to 2025-11-18)
        const userRangeCount = await TbZeptoAdsKeywordData.count({
            where: {
                date: {
                    [Op.between]: ['2025-11-04', '2025-11-18']
                }
            }
        });
        console.log(`Rows in User Range (Nov 4-18, 2025): ${userRangeCount}`);

        // 3. Check exact match for one day in range if count is 0
        if (userRangeCount === 0) {
            const checkOneDay = await TbZeptoAdsKeywordData.findAll({
                where: {
                    date: '2025-11-04'
                }
            });
            console.log("Check 2025-11-04:", checkOneDay.length);
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

checkDateRange();
