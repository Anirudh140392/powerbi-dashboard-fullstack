import 'dotenv/config';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import { Sequelize } from 'sequelize';

async function checkData() {
    try {
        const stats = await RbPdpOlap.findAll({
            attributes: [
                'Platform',
                [Sequelize.fn('MIN', Sequelize.col('DATE')), 'minDate'],
                [Sequelize.fn('MAX', Sequelize.col('DATE')), 'maxDate'],
                [Sequelize.fn('COUNT', Sequelize.col('*')), 'rows'],
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'totalSales']
            ],
            group: ['Platform'],
            raw: true
        });
        console.log('Platform Stats:', JSON.stringify(stats, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkData();
