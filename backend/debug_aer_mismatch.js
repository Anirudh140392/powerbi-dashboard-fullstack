
import 'dotenv/config';
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import TbZeptoBrandSalesAnalytics from './src/models/TbZeptoBrandSalesAnalytics.js';
import dayjs from 'dayjs';

const debugAer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');

        const startDate = dayjs('2025-10-01');
        const endDate = dayjs('2025-12-09');
        const dateFilter = { [Op.between]: [startDate.toDate(), endDate.toDate()] };

        // 1. Check RbPdpOlap (Top Cards Source)
        const pdpWhere = {
            DATE: dateFilter,
            Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), 'zepto'),
            Brand: { [Op.like]: '%Aer%' } // Check for Aer
        };

        const pdpCount = await RbPdpOlap.count({ where: pdpWhere });
        const pdpSales = await RbPdpOlap.sum('Sales', { where: pdpWhere });
        console.log(`RbPdpOlap (Aer, Zepto): Rows=${pdpCount}, Sales=${pdpSales}`);

        const pdpBrands = await RbPdpOlap.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Brand')), 'Brand']],
            where: pdpWhere,
            raw: true
        });
        console.log('RbPdpOlap Brands matching Aer:', pdpBrands.map(b => b.Brand));

        // 2. Check TbZeptoBrandSalesAnalytics (Brands Overview Source)
        const zeptoWhere = {
            sales_date: dateFilter,
            brand_name: { [Op.like]: '%Aer%' }
        };

        const zeptoCount = await TbZeptoBrandSalesAnalytics.count({ where: zeptoWhere });
        const zeptoGmv = await TbZeptoBrandSalesAnalytics.sum('gmv', { where: zeptoWhere });
        console.log(`TbZepto (Aer): Rows=${zeptoCount}, GMV=${zeptoGmv}`);

        const zeptoBrands = await TbZeptoBrandSalesAnalytics.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: zeptoWhere,
            raw: true
        });
        console.log('TbZepto Brands matching Aer:', zeptoBrands.map(b => b.brand_name));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
};

debugAer();
