import RbPdpOlap from './backend/src/models/RbPdpOlap.js';
import { Sequelize } from 'sequelize';

async function checkData() {
    try {
        const stats = await RbPdpOlap.findAll({
            attributes: [
                [Sequelize.fn('MIN', Sequelize.col('DATE')), 'minDate'],
                [Sequelize.fn('MAX', Sequelize.col('DATE')), 'maxDate'],
                [Sequelize.fn('COUNT', Sequelize.col('*')), 'totalRows'],
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'totalSales']
            ],
            raw: true
        });
        console.log('Overall Stats:', stats);

        const platforms = await RbPdpOlap.findAll({
            attributes: ['Platform', [Sequelize.fn('COUNT', Sequelize.col('*')), 'rows']],
            group: ['Platform'],
            raw: true
        });
        console.log('Platforms:', platforms);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkData();
