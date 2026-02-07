import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import RbBrandMs from './src/models/RbBrandMs.js';
import RcaSkuDim from './src/models/RcaSkuDim.js';

// Mock functions since they are not exported
const getAvailability = async () => 85.5;
const getShareOfSearch = async () => 12.3;

async function verifyCategoryOverview() {
    try {
        console.log("--- Verifying Category Overview Metrics ---");

        const startDate = '2025-10-01';
        const endDate = '2025-12-09';
        const brand = 'Godrej No.1';
        const platform = 'Zepto';

        // ... imports ...

        // 0. Check available categories from RcaSkuDim
        console.log("\n0. Checking available categories for Godrej No.1 on Zepto from RcaSkuDim...");
        const categories = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'category']],
            where: {
                platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), platform.toLowerCase()),
                brand_name: { [Op.like]: `%${brand}%` }
            },
            raw: true
        });
        console.log("Available Categories (RcaSkuDim):", categories.map(c => c.category));

        const category = categories.length > 0 ? categories[0].category : 'Core Tub';

        console.log(`\nTesting with Category: ${category}`);

        const catWhere = {
            DATE: { [Op.between]: [startDate, endDate] },
            Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()),
            Category: category
        };

        // 1. Offtake & Ad Metrics
        const catOfftakeResult = await RbPdpOlap.findOne({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
            ],
            where: catWhere,
            raw: true
        });
        console.log("\n1. Offtake & Ad Metrics:", catOfftakeResult);

        // 2. Promo My Brand (Comp_flag = 0)
        const promoMyBrand = await RbPdpOlap.findOne({
            attributes: [
                [Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']
            ],
            where: {
                ...catWhere,
                Comp_flag: 0
            },
            raw: true
        });
        console.log("\n2. Promo My Brand (Comp_flag=0):", promoMyBrand);

        // 3. Promo Compete (Comp_flag = 1)
        const promoCompete = await RbPdpOlap.findOne({
            attributes: [
                [Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']
            ],
            where: {
                ...catWhere,
                Comp_flag: 1
            },
            raw: true
        });
        console.log("\n3. Promo Compete (Comp_flag=1):", promoCompete);

        // 5. Simulate full Category Object construction
        console.log("\n5. Simulating Full Category Object:");
        const catObject = {
            key: category,
            label: category,
            type: category,
            columns: [
                { title: "Offtakes", value: catOfftakeResult?.total_sales || 0 },
                { title: "Promo My Brand", value: promoMyBrand?.avg_promo_depth || 0 },
                { title: "Promo Compete", value: promoCompete?.avg_promo_depth || 0 }
            ]
        };
        console.log(JSON.stringify(catObject, null, 2));


    } catch (error) {
        console.error("Error verifying Category Overview:", error);
    }
}

verifyCategoryOverview();
