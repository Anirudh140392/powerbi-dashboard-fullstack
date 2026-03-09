
import { Sequelize, Op } from 'sequelize';

const sequelize = new Sequelize('gcpl', 'readonly_user', 'Readonly@123', {
    host: '15.207.197.27',
    dialect: 'mysql',
    logging: false
});

const RbPdpOlap = sequelize.define('rb_pdp_olap', {
    DATE: { type: Sequelize.DATEONLY },
    Brand: { type: Sequelize.STRING },
    Platform: { type: Sequelize.STRING },
    Location: { type: Sequelize.STRING },
    Sales: { type: Sequelize.FLOAT }
}, { tableName: 'rb_pdp_olap', timestamps: false });

const check = async () => {
    try {
        await sequelize.authenticate();
        const start = '2025-10-01';
        const end = '2025-10-06';

        console.log(`Checking for ~1.34 Cr in period ${start} to ${end}`);

        // 1. Zepto + Aer + All Locations
        const v1 = await RbPdpOlap.sum('Sales', {
            where: {
                DATE: { [Op.between]: [start, end] },
                Platform: 'Zepto',
                Brand: { [Op.like]: '%Aer%' }
            }
        });
        console.log(`Zepto + Aer + All Locations: ₹${(v1 || 0).toLocaleString()}`);

        // 2. Zepto + All Brands + Agra
        const v2 = await RbPdpOlap.sum('Sales', {
            where: {
                DATE: { [Op.between]: [start, end] },
                Platform: 'Zepto',
                Location: 'Agra'
            }
        });
        console.log(`Zepto + All Brands + Agra: ₹${(v2 || 0).toLocaleString()}`);

        // 3. All Platforms + Aer + Agra
        const v3 = await RbPdpOlap.sum('Sales', {
            where: {
                DATE: { [Op.between]: [start, end] },
                Brand: { [Op.like]: '%Aer%' },
                Location: 'Agra'
            }
        });
        console.log(`All Platforms + Aer + Agra: ₹${(v3 || 0).toLocaleString()}`);

        // 4. Zepto + All Brands + All Locations (Just in case)
        const v4 = await RbPdpOlap.sum('Sales', {
            where: {
                DATE: { [Op.between]: [start, end] },
                Platform: 'Zepto'
            }
        });
        console.log(`Zepto + All Brands + All Locations: ₹${(v4 || 0).toLocaleString()}`);

    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
};

check();
