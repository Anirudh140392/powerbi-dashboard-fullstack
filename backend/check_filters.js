import { DataTypes, Sequelize } from 'sequelize';
import 'dotenv/config';
import sequelize from './src/config/db.js';
import TbZeptoAdsKeywordData from './src/models/TbZeptoAdsKeywordData.js';

async function checkFilters() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // 1. Distinct Brands
        const brands = await TbZeptoAdsKeywordData.findAll({
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('brand')), 'brand']
            ],
            raw: true
        });
        console.log('Available Brands:', brands.map(b => b.brand));

        // 2. Distinct Platforms
        const platforms = await TbZeptoAdsKeywordData.findAll({
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('platform')), 'platform']
            ],
            raw: true
        });
        console.log('Available Platforms:', platforms.map(p => p.platform));

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

checkFilters();
