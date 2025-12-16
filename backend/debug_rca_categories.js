import 'dotenv/config';
import { Sequelize, DataTypes } from 'sequelize';
import sequelize from './src/config/db.js';

const RcaSkuDim = sequelize.define('rca_sku_dim', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY },
    platform: { type: DataTypes.STRING },
    brand_name: { type: DataTypes.STRING },
    brand_category: { type: DataTypes.STRING },
    sku_name: { type: DataTypes.STRING },
    location: { type: DataTypes.STRING }
}, {
    tableName: 'rca_sku_dim',
    timestamps: false
});

async function run() {
    try {
        console.log("Checking RcaSkuDim for Zepto and Aer...");

        const count = await RcaSkuDim.count({
            where: {
                platform: 'Zepto',
                brand_name: 'Aer'
            }
        });
        console.log("Exact Match Count:", count);

        const categories = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']],
            where: {
                platform: 'Zepto',
                brand_name: 'Aer'
            },
            raw: true
        });
        console.log("Categories (Exact):", categories);

        // Check case insensitive
        const countLower = await RcaSkuDim.count({
            where: {
                platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), 'zepto'),
                brand_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), 'aer')
            }
        });
        console.log("Case Insensitive Match Count:", countLower);

        const categoriesLower = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']],
            where: {
                platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), 'zepto'),
                brand_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), 'aer')
            },
            raw: true
        });
        console.log("Categories (Case Insensitive):", categoriesLower);

        // Check Zepto categories generally
        const zeptoCategories = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']],
            where: {
                platform: 'Zepto',
                brand_category: { [Sequelize.Op.ne]: null }
            },
            limit: 10,
            raw: true
        });
        console.log("Zepto Categories (Non-null sample):", zeptoCategories);

        // Check Aer categories on other platforms
        const aerCategories = await RcaSkuDim.findAll({
            attributes: [
                'platform',
                [Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']
            ],
            where: {
                brand_name: 'Aer',
                brand_category: { [Sequelize.Op.ne]: null }
            },
            group: ['platform', 'brand_category'],
            raw: true
        });
        console.log("Aer Categories (All Platforms):", aerCategories);


    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
}

run();
