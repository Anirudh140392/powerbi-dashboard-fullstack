
import dotenv from 'dotenv';
dotenv.config();

const runCheck = async () => {
    try {
        const { default: sequelize } = await import('./src/config/db.js');
        const { default: RbKw } = await import('./src/models/RbKw.js');
        const { Sequelize } = await import('sequelize');

        console.log("Checking RbKw distinct values...");
        await sequelize.authenticate();

        const brands = await RbKw.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            raw: true,
            limit: 20
        });
        
        console.log("Brands:", brands.map(b => b.brand_name));

        const platforms = await RbKw.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('platform_name')), 'platform_name']],
            raw: true
        });
        console.log("Platforms:", platforms.map(p => p.platform_name));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        try {
            const { default: sequelize } = await import('./src/config/db.js');
            await sequelize.close();
        } catch (e) { }
    }
};

runCheck();
