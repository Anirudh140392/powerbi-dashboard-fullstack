import 'dotenv/config';
import { Sequelize, DataTypes } from 'sequelize';
import sequelize from './src/config/db.js';

const RbPdpOlap = sequelize.define('rb_pdp_olap', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    DATE: { type: DataTypes.DATEONLY },
    Platform: { type: DataTypes.STRING },
    Brand: { type: DataTypes.STRING },
    Category: { type: DataTypes.STRING },
    Sales: { type: DataTypes.FLOAT }
}, {
    tableName: 'rb_pdp_olap',
    timestamps: false
});

async function run() {
    try {
        console.log("Checking RbPdpOlap for Zepto and Aer...");

        const categories = await RbPdpOlap.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Category')), 'Category']],
            where: {
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), 'zepto'),
                Brand: { [Sequelize.Op.like]: '%Aer%' }
            },
            raw: true
        });
        console.log("RbPdpOlap Categories:", categories);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
}

run();
