import { DataTypes, Sequelize } from 'sequelize';
import 'dotenv/config';
import sequelize from './src/config/db.js';
import TbZeptoAdsKeywordData from './src/models/TbZeptoAdsKeywordData.js';

async function inspectData() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // 0. Ensure table exists
        await TbZeptoAdsKeywordData.sync();
        console.log("Table tb_zepto_ads_keyword_data synced (created if not exists).");

        // 1. Get simple count
        const count = await TbZeptoAdsKeywordData.count();
        console.log(`Total Rows in TbZeptoAdsKeywordData: ${count}`);

        if (count > 0) {
            // 2. Get 5 latest rows
            const latestRows = await TbZeptoAdsKeywordData.findAll({
                limit: 5
            });
            console.log("Sample Rows:", JSON.stringify(latestRows, null, 2));

            // 3. Get Sum of Impressions
            const totalImpressions = await TbZeptoAdsKeywordData.sum('impressions');
            console.log(`Total Impressions: ${totalImpressions}`);
        } else {
            console.log("Table is empty!");
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

inspectData();
