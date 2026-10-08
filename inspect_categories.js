
import RbPdpOlap from './backend/src/models/RbPdpOlap.js';
import { Sequelize } from 'sequelize';

async function inspect() {
    try {
        const categories = await RbPdpOlap.findAll({
            attributes: [
                'Category',
                [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
            ],
            group: ['Category'],
            limit: 20,
            raw: true
        });
        console.log('Sample Categories:', categories);

        const productTypes = await RbPdpOlap.findAll({
            attributes: [
                'Product_type',
                [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
            ],
            group: ['Product_type'],
            limit: 20,
            raw: true
        });
        console.log('Sample Product_types:', productTypes);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

inspect();
