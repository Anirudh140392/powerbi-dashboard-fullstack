
import 'dotenv/config';
import sequelize from './src/config/db.js';
import { Op } from 'sequelize';
import RbPdpOlap from './src/models/RbPdpOlap.js';

const check = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const brand = 'Aer';
        const location = 'Agra';
        const platform = 'Zepto';

        // 1. Current Period: Sep 1 - Nov 15
        const currentSales = await RbPdpOlap.sum('Sales', {
            where: {
                DATE: { [Op.between]: ['2025-09-01', '2025-11-15'] },
                Brand: { [Op.like]: `%${brand}%` },
                Location: location,
                Platform: platform
            }
        });
        console.log(`Current Sales (Sep 1 - Nov 15): ${currentSales}`);

        // 2. Compare Period: Sep 1 - Sep 6
        const compareSales = await RbPdpOlap.sum('Sales', {
            where: {
                DATE: { [Op.between]: ['2025-09-01', '2025-09-06'] },
                Brand: { [Op.like]: `%${brand}%` },
                Location: location,
                Platform: platform
            }
        });
        console.log(`Compare Sales (Sep 1 - Sep 6): ${compareSales}`);

        // 3. Check where the sales actually are
        const salesByMonth = await RbPdpOlap.findAll({
            attributes: [
                [sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m'), 'month'],
                [sequelize.fn('SUM', sequelize.col('Sales')), 'total_sales']
            ],
            where: {
                DATE: { [Op.between]: ['2025-09-01', '2025-11-15'] },
                Brand: { [Op.like]: `%${brand}%` },
                Location: location,
                Platform: platform
            },
            group: [sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m')],
            raw: true
        });
        console.log('Sales Distribution by Month:', salesByMonth);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
};

check();
