import 'dotenv/config';
import sequelize from './src/config/db.js';
import TbZeptoAdsKeywordData from './src/models/TbZeptoAdsKeywordData.js';

async function checkFilters() {
    try {
        await sequelize.authenticate();

        // Check for NULLs
        const nullBrand = await TbZeptoAdsKeywordData.count({ where: { brand: null } });
        const nullPlatform = await TbZeptoAdsKeywordData.count({ where: { platform: null } });

        // Distinct values
        const brands = await TbZeptoAdsKeywordData.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand')), 'brand']],
            raw: true
        });

        const platforms = await TbZeptoAdsKeywordData.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('platform')), 'platform']],
            raw: true
        });

        console.log("RESULTS_START");
        console.log("Null Brands Count:", nullBrand);
        console.log("Distinct Brands:", JSON.stringify(brands.map(b => b.brand)));
        console.log("Null Platforms Count:", nullPlatform);
        console.log("Distinct Platforms:", JSON.stringify(platforms.map(p => p.platform)));
        console.log("RESULTS_END");

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

checkFilters();
