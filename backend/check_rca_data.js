import dotenv from 'dotenv';
dotenv.config();
import RcaSkuDim from './src/models/RcaSkuDim.js';
import sequelize from './src/config/db.js';

const checkData = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const count = await RcaSkuDim.count();
        console.log(`Total rows in rca_sku_dim: ${count}`);

        if (count > 0) {
            const sample = await RcaSkuDim.findOne({ raw: true });
            console.log('Sample row:', sample);

            const platforms = await RcaSkuDim.findAll({
                attributes: ['platform_name'],
                group: ['platform_name'],
                raw: true
            });
            console.log('Platforms:', platforms);
        } else {
            console.log('Table is empty!');
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
};

checkData();
