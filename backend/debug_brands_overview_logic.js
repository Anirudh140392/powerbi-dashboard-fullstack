
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import RcaSkuDim from './src/models/RcaSkuDim.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';

async function verifyBrandsOverview() {
    try {
        const platform = 'Zepto';
        const category = 'Cleaning Essentials'; // Example category

        console.log(`Verifying Brands Overview for Platform: ${platform}, Category: ${category}`);

        // 1. Fetch Brands from RcaSkuDim
        const rcaBrandWhere = {
            platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), platform.toLowerCase()),
            brand_category: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_category')), category.toLowerCase())
        };

        const brands = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: rcaBrandWhere,
            raw: true
        });

        const brandList = brands.map(b => b.brand_name);
        console.log(`Found ${brandList.length} brands in RcaSkuDim:`, brandList.slice(0, 10));

        if (brandList.length === 0) {
            console.log("No brands found. Checking distinct categories in RcaSkuDim...");
            const cats = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'category']],
                limit: 10,
                raw: true
            });
            console.log("Sample Categories:", cats);
            return;
        }

        // 2. Check Offtake for one of the brands
        const testBrand = brandList[0];
        console.log(`Checking Offtake for brand: ${testBrand}`);

        // 3. Simulate Zepto Query with Category Filter
        const TbZeptoBrandSalesAnalytics = await import('./src/models/TbZeptoBrandSalesAnalytics.js').then(m => m.default);
        const zeptoMetrics = await TbZeptoBrandSalesAnalytics.findOne({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('gmv')), 'total_sales']
            ],
            where: {
                brand_name: { [Op.like]: `%${testBrand}%` },
                sku_category: sequelize.where(sequelize.fn('LOWER', sequelize.col('sku_category')), category.toLowerCase())
            },
            raw: true
        });
        console.log(`Zepto Sales for ${testBrand} (Category: ${category}):`, zeptoMetrics);

    } catch (error) {
        console.error("Error verifying Brands Overview:", error);
    }
}

verifyBrandsOverview();
