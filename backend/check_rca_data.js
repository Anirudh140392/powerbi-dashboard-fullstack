
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize } from 'sequelize';

const checkRcaSkuDim = async () => {
    // Dynamic imports to ensure env vars are loaded
    const { default: RcaSkuDim } = await import('./src/models/RcaSkuDim.js');
    const { default: sequelize } = await import('./src/config/db.js');

    try {
        console.log("Checking RcaSkuDim data...");

        // Check total count
        const count = await RcaSkuDim.count();
        console.log(`Total rows in RcaSkuDim: ${count}`);

        // Check a sample row
        const sample = await RcaSkuDim.findOne();
        console.log("Sample row:", JSON.stringify(sample, null, 2));

        // Check distinct brand_category
        const categories = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']],
            raw: true
        });
        console.log("Distinct Categories:", categories);

        // Check with filters
        const filters = {
            platform: 'Zepto',
            brand_name: 'Aer',
            location: 'Agra'
        };
        console.log("Checking with filters:", filters);
        const filtered = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']],
            where: filters,
            raw: true
        });
        console.log("Filtered Categories:", filtered);

        // Check for Aer categories globally
        console.log("Checking Aer categories globally:");
        const aerCats = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']],
            where: { brand_name: 'Aer' },
            raw: true
        });
        console.log("Aer Categories:", aerCats);

        // Find a brand/location with categories
        console.log("Finding a brand/location with categories:");
        const validSample = await RcaSkuDim.findOne({
            where: {
                brand_category: { [Sequelize.Op.ne]: null }
            }
        });
        console.log("Valid Sample:", JSON.stringify(validSample, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
};

checkRcaSkuDim();
