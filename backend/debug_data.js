import 'dotenv/config';
import TbZeptoBrandSalesAnalytics from './src/models/TbZeptoBrandSalesAnalytics.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import ZeptoMarketShare from './src/models/ZeptoMarketShare.js';
import sequelize from './src/config/db.js';
import { Op } from 'sequelize';

const debugData = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB");

        const brand = "Godrej";
        const location = "Agra";
        const startDate = new Date("2025-10-01");
        const endDate = new Date("2025-10-31");

        console.log(`Checking data for Brand: ${brand}, Location: ${location}, Date: Oct 2025`);

        // Check TbZeptoBrandSalesAnalytics
        const zeptoCount = await TbZeptoBrandSalesAnalytics.count({
            where: {
                brand_name: brand,
                city: location,
                sales_date: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });
        console.log(`TbZeptoBrandSalesAnalytics count (Exact Match): ${zeptoCount}`);

        const zeptoCountLower = await TbZeptoBrandSalesAnalytics.count({
            where: {
                brand_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brand.toLowerCase()),
                city: sequelize.where(sequelize.fn('LOWER', sequelize.col('city')), location.toLowerCase()),
                sales_date: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });
        console.log(`TbZeptoBrandSalesAnalytics count (Case Insensitive): ${zeptoCountLower}`);

        // Check RbPdpOlap
        const olapCount = await RbPdpOlap.count({
            where: {
                Brand: brand,
                Location: location,
                DATE: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });
        console.log(`RbPdpOlap count (Exact Match): ${olapCount}`);

        const olapCountLower = await RbPdpOlap.count({
            where: {
                Brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('Brand')), brand.toLowerCase()),
                Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()),
                DATE: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });
        console.log(`RbPdpOlap count (Case Insensitive): ${olapCountLower}`);


        // Check ZeptoMarketShare
        const marketShareCount = await ZeptoMarketShare.count({
            where: {
                brand: brand,
                Location: location,
                created_on: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });
        console.log(`ZeptoMarketShare count (Exact Match): ${marketShareCount}`);

        // List some distinct brands and locations to see what's in there
        const distinctBrands = await TbZeptoBrandSalesAnalytics.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand_name')), 'brand_name']],
            limit: 10,
            raw: true
        });
        console.log("Sample Brands in TbZepto:", distinctBrands.map(b => b.brand_name));

        const distinctLocations = await TbZeptoBrandSalesAnalytics.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('city')), 'city']],
            limit: 10,
            raw: true
        });
        console.log("Sample Locations in TbZepto:", distinctLocations.map(l => l.city));

        const distinctBrandsOlap = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Brand')), 'Brand']],
            limit: 10,
            raw: true
        });
        console.log("Sample Brands in RbPdpOlap:", distinctBrandsOlap.map(b => b.Brand));

        const distinctLocationsOlap = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'Location']],
            limit: 10,
            raw: true
        });
        console.log("Sample Locations in RbPdpOlap:", distinctLocationsOlap.map(l => l.Location));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
};

debugData();
