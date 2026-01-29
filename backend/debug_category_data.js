import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import RbBrandMs from './src/models/RbBrandMs.js';
import RbKw from './src/models/RbKw.js';

async function checkCategoryData() {
    try {
        // ... previous checks ...

        // 3. Check RbBrandMs for "Hair"
        const msData = await RbBrandMs.findAll({
            attributes: ['category', 'brand', 'market_share', 'Platform'],
            where: {
                category: { [Op.like]: '%Hair%' }
            },
            limit: 5,
            raw: true
        });
        console.log("RbBrandMs 'Hair' data:", msData);

        // 4. Check RbKw for "Hair"
        const kwData = await RbKw.findAll({
            attributes: ['keyword_category', 'brand_name', 'platform_name'],
            where: {
                keyword_category: { [Op.like]: '%Hair%' }
            },
            limit: 5,
            raw: true
        });
        // 5. Simulate SOS Check (Case Insensitive)
        const sosCount = await RbKw.count({
            where: {
                keyword_category: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('keyword_category')), 'hair care')
            }
        });
        console.log("SOS Count for 'hair care' (case-insensitive):", sosCount);

    } catch (error) {
        console.error("Error checking data:", error);
    }
}

checkCategoryData();
