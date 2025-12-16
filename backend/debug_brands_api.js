
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import RcaSkuDim from './src/models/RcaSkuDim.js';
import TbZeptoBrandSalesAnalytics from './src/models/TbZeptoBrandSalesAnalytics.js';

async function simulateBrandsOverview() {
    try {
        console.log("--- Simulating Brands Overview API Logic ---");

        const testCases = [
            { platform: 'Zepto', category: 'Cleaning Essentials' },
            { platform: 'Zepto', category: 'Hair Care' },
            { platform: 'Blinkit', category: 'All' }
        ];

        for (const test of testCases) {
            console.log(`\nTesting Platform: ${test.platform}, Category: ${test.category}`);

            // 1. Fetch Brands from RcaSkuDim
            const rcaBrandWhere = {};
            if (test.platform && test.platform !== 'All') {
                rcaBrandWhere.platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), test.platform.toLowerCase());
            }
            if (test.category && test.category !== 'All') {
                rcaBrandWhere.brand_category = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_category')), test.category.toLowerCase());
            }

            const brands = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                where: rcaBrandWhere,
                raw: true
            });

            const brandList = brands.map(b => b.brand_name);
            console.log(`Fetched ${brandList.length} brands:`, brandList.slice(0, 5), brandList.length > 5 ? '...' : '');

            // 2. Simulate Offtake Query (Zepto only for now)
            if (test.platform === 'Zepto' && brandList.length > 0) {
                const testBrand = brandList[0];
                const zeptoWhere = {
                    brand_name: { [Op.like]: `%${testBrand}%` }
                };
                if (test.category !== 'All') {
                    zeptoWhere.sku_category = sequelize.where(sequelize.fn('LOWER', sequelize.col('sku_category')), test.category.toLowerCase());
                }

                const sales = await TbZeptoBrandSalesAnalytics.findOne({
                    attributes: [[Sequelize.fn('SUM', Sequelize.col('gmv')), 'total_sales']],
                    where: zeptoWhere,
                    raw: true
                });
                console.log(`Sales for ${testBrand} in ${test.category}:`, sales);

                // 3. Specific Check for Bblunt in Hair Care
                if (test.category === 'Hair Care') {
                    console.log("Checking Bblunt details in Zepto...");
                    const bbluntSales = await TbZeptoBrandSalesAnalytics.findAll({
                        attributes: ['brand_name', 'sku_category', 'gmv'],
                        where: {
                            brand_name: { [Op.like]: '%Bblunt%' },
                            sku_category: { [Op.like]: '%Hair Care%' }
                        },
                        limit: 5,
                        raw: true
                    });
                    console.log("Bblunt Raw Data:", bbluntSales);
                }
            }
        }

    } catch (error) {
        console.error("Error simulating Brands Overview:", error);
    }
}

simulateBrandsOverview();
