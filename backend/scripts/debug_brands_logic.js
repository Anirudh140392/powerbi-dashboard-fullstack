import 'dotenv/config';
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import RcaSkuDim from './src/models/RcaSkuDim.js';

async function debugBrandsLogic() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const platform = 'Zepto';

        // 1. Fetch Categories for Zepto
        console.log(`\nFetching categories for ${platform}...`);
        const categories = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']],
            where: { platform },
            raw: true
        });
        const categoryList = categories.map(c => c.brand_category).filter(Boolean);
        console.log('Categories:', categoryList);

        if (categoryList.length === 0) {
            console.log('No categories found. Exiting.');
            return;
        }

        const testCategory = categoryList[0]; // Pick first category

        // 2. Fetch Brands for Zepto + All Categories
        console.log(`\nFetching brands for ${platform} + All Categories...`);
        const brandsAll = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: { platform },
            raw: true
        });
        const brandListAll = brandsAll.map(b => b.brand_name).filter(Boolean);
        console.log(`Found ${brandListAll.length} brands (All). Sample:`, brandListAll.slice(0, 5));

        // 3. Fetch Brands for Zepto + Specific Category
        console.log(`\nFetching brands for ${platform} + ${testCategory}...`);
        const brandsCat = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: { platform, brand_category: testCategory },
            raw: true
        });
        const brandListCat = brandsCat.map(b => b.brand_name).filter(Boolean);
        console.log(`Found ${brandListCat.length} brands (${testCategory}). Sample:`, brandListCat.slice(0, 5));

        // 4. Compare
        if (brandListAll.length !== brandListCat.length) {
            console.log('\nSUCCESS: Brand list changed when filtering by category.');
        } else {
            console.log('\nWARNING: Brand list count is same. This might be correct if all brands are in this category, but check data.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

debugBrandsLogic();
