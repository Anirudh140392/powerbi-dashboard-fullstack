
import 'dotenv/config';
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import RcaSkuDim from './src/models/RcaSkuDim.js';

const checkRcaAer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');

        const rcaBrands = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: {
                brand_name: { [Op.like]: '%Aer%' }
            },
            raw: true
        });
        console.log('RcaSkuDim Brands matching Aer:', rcaBrands.map(b => b.brand_name));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
};

checkRcaAer();
