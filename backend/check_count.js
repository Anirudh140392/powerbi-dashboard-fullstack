import 'dotenv/config';
import sequelize from './src/config/db.js';
import TbZeptoAdsKeywordData from './src/models/TbZeptoAdsKeywordData.js';

async function checkCount() {
    try {
        await sequelize.authenticate();
        const count = await TbZeptoAdsKeywordData.count();
        console.log(`__COUNT__:${count}`); // Unique marker to grep
    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}
checkCount();
