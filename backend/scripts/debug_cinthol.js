
import 'dotenv/config';
import sequelize from './src/config/db.js';
import { Op } from 'sequelize';
import RbPdpOlap from './src/models/RbPdpOlap.js';

const check = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // Check data for Cinthol in Sep 1-6
        const cintholData = await RbPdpOlap.count({
            where: {
                DATE: { [Op.between]: ['2025-09-01', '2025-09-06'] },
                Brand: { [Op.like]: '%Cinthol%' },
                Location: 'Agra',
                Platform: 'Zepto'
            }
        });
        console.log(`Total rows for Cinthol/Agra/Zepto in Sep 1-6: ${cintholData}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
};

check();
