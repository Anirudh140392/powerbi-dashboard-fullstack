
import dotenv from 'dotenv';
dotenv.config();
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import ZeptoMarketShare from './src/models/ZeptoMarketShare.js';
import { Op } from 'sequelize';

const debugDove = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        const brand = "Dove";
        const locationCorrect = "Ahmedabad";
        console.log(`\n--- Searching for brands containing '${brand}' ---`);

        const olapBrands = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Brand')), 'Brand']],
            where: {
                Brand: { [Op.like]: `%${brand}%` }
            },
            raw: true
        });
        console.log("RbPdpOlap Brands:", olapBrands.map(b => b.Brand));

        const msBrands = await ZeptoMarketShare.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand')), 'brand']],
            where: {
                brand: { [Op.like]: `%${brand}%` }
            },
            raw: true
        });
        console.log("ZeptoMarketShare Brands:", msBrands.map(b => b.brand));

        // 3. Check RcaSkuDim
        console.log("\n3. RcaSkuDim (Dropdown Source)");
        const rcaBrands = await import('./src/models/RcaSkuDim.js').then(m => m.default.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand_name')), 'brand_name']],
            where: {
                brand_name: { [Op.like]: `%${brand}%` }
            },
            raw: true
        }));
        console.log("RcaSkuDim Brands:", rcaBrands.map(b => b.brand_name));

        // 4. List ALL brands from RbPdpOlap
        console.log("\n4. ALL Brands from RbPdpOlap");
        const allBrands = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Brand')), 'Brand']],
            raw: true
        });
        console.log("All RbPdpOlap Brands:", allBrands.map(b => b.Brand));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
};

debugDove();
