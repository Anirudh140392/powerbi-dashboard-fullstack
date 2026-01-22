import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import { Op } from 'sequelize';

async function checkData() {
    try {
        const latest = await RbPdpOlap.findOne({
            order: [['DATE', 'DESC']],
            raw: true
        });
        console.log('Latest Date in DB:', latest?.DATE);

        const counts = await RbPdpOlap.findAll({
            attributes: ['Category', [sequelize.fn('COUNT', sequelize.col('*')), 'count']],
            group: ['Category'],
            raw: true
        });
        console.log('Category counts:', counts);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkData();
