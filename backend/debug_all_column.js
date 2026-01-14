
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

const checkAll = async () => {
    try {
        await sequelize.authenticate();
        const start = '2025-10-01';
        const end = '2025-10-06';

        console.log(`Checking "All" Metrics for Aer/Agra (${start} to ${end})`);

        // 1. All Offtake (Ignoring Platform)
        const allOfftake = await RbPdpOlap.sum('Sales', {
            where: {
                DATE: { [Op.between]: [start, end] },
                Brand: { [Op.like]: '%Aer%' },
                Location: 'Agra'
            }
        });
        console.log(`All Offtake: ₹${(allOfftake || 0).toLocaleString()}`);

        // 2. Zepto Offtake (Specific Platform)
        const zeptoOfftake = await RbPdpOlap.sum('Sales', {
            where: {
                DATE: { [Op.between]: [start, end] },
                Brand: { [Op.like]: '%Aer%' },
                Location: 'Agra',
                Platform: 'Zepto'
            }
        });
        console.log(`Zepto Offtake: ₹${(zeptoOfftake || 0).toLocaleString()}`);

        if (allOfftake === zeptoOfftake) {
            console.log("Note: Values match because only Zepto might have data for this filter.");
        } else {
            console.log("Values differ, confirming 'All' aggregates multiple platforms.");
        }

    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
};

checkAll();
