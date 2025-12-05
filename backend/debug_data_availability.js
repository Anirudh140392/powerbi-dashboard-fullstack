import dotenv from 'dotenv';
dotenv.config();
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import TbZeptoBrandSalesAnalytics from './src/models/TbZeptoBrandSalesAnalytics.js';
import ZeptoMarketShare from './src/models/ZeptoMarketShare.js';
import { Op } from 'sequelize';

const checkData = async () => {
    try {
        console.log("Checking data availability...");

        // 1. Check RbPdpOlap (Offtake & Availability)
        const olapCount = await RbPdpOlap.count();
        console.log(`Total records in RbPdpOlap: ${olapCount}`);

        const olapSample = await RbPdpOlap.findOne({ raw: true });
        console.log("Sample RbPdpOlap record:", olapSample);

        // Check distinct Platforms in RbPdpOlap
        const platforms = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Platform')), 'Platform']],
            raw: true
        });
        console.log("Distinct Platforms in RbPdpOlap:", platforms.map(p => p.Platform));

        // Check distinct Locations in RbPdpOlap
        const locations = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'Location']],
            raw: true
        });
        console.log("Distinct Locations in RbPdpOlap:", locations.map(l => l.Location));

        // 2. Check TbZeptoBrandSalesAnalytics (Top SKUs)
        const salesCount = await TbZeptoBrandSalesAnalytics.count();
        console.log(`Total records in TbZeptoBrandSalesAnalytics: ${salesCount}`);

        const salesSample = await TbZeptoBrandSalesAnalytics.findOne({ raw: true });
        console.log("Sample TbZeptoBrandSalesAnalytics record:", salesSample);

        // Check distinct Cities in TbZeptoBrandSalesAnalytics
        const cities = await TbZeptoBrandSalesAnalytics.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('city')), 'city']],
            raw: true
        });
        console.log("Distinct Cities in TbZeptoBrandSalesAnalytics:", cities.map(c => c.city));


        // 3. Check ZeptoMarketShare (Market Share)
        const marketShareCount = await ZeptoMarketShare.count();
        console.log(`Total records in ZeptoMarketShare: ${marketShareCount}`);

        const marketShareSample = await ZeptoMarketShare.findOne({ raw: true });
        console.log("Sample ZeptoMarketShare record:", marketShareSample);

    } catch (error) {
        console.error("Error checking data:", error);
    } finally {
        await sequelize.close();
    }
};

checkData();
