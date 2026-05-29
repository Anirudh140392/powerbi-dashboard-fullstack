
import 'dotenv/config';
import sequelize from './src/config/db.js';
import { Op } from 'sequelize';
import RbPdpOlap from './src/models/RbPdpOlap.js';

const check = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Check ANY data for Sep 1-6
        const anyData = await RbPdpOlap.count({
            where: {
                DATE: { [Op.between]: ['2025-09-01', '2025-09-06'] }
            }
        });
        console.log(`Total rows for Sep 1-6 (Any Brand/Loc/Platform): ${anyData}`);

        // 2. Check data for Zepto in Sep 1-6
        const zeptoData = await RbPdpOlap.count({
            where: {
                DATE: { [Op.between]: ['2025-09-01', '2025-09-06'] },
                Platform: 'Zepto'
            }
        });
        console.log(`Total rows for Zepto in Sep 1-6: ${zeptoData}`);

        // 3. Check data for Aer in Sep 1-6
        const aerData = await RbPdpOlap.count({
            where: {
                DATE: { [Op.between]: ['2025-09-01', '2025-09-06'] },
                Brand: { [Op.like]: '%Aer%' }
            }
        });
        console.log(`Total rows for Aer in Sep 1-6: ${aerData}`);

        // 4. Check data for Agra in Sep 1-6
        const agraData = await RbPdpOlap.count({
            where: {
                DATE: { [Op.between]: ['2025-09-01', '2025-09-06'] },
                Location: 'Agra'
            }
        });
        console.log(`Total rows for Agra in Sep 1-6: ${agraData}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
};

check();
