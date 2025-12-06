
import { Sequelize, Op } from 'sequelize';

const sequelize = new Sequelize('gcpl', 'readonly_user', 'Readonly@123', {
    host: '15.207.197.27',
    dialect: 'mysql',
    logging: false
});

const RbKw = sequelize.define('rb_kw', {
    kw_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    keyword: { type: Sequelize.STRING },
    platform_name: { type: Sequelize.STRING },
    brand_name: { type: Sequelize.STRING },
    location_name: { type: Sequelize.STRING },
    kw_crawl_date: { type: Sequelize.DATEONLY },
    spons_flag: { type: Sequelize.INTEGER }
}, {
    tableName: 'rb_kw',
    timestamps: false
});

const checkSos = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');

        const startDate = '2025-10-01';
        const endDate = '2025-10-06';
        const location = 'Ahmedabad';
        const platform = 'Zepto';
        const brand = 'Aer';

        const baseWhere = {
            kw_crawl_date: { [Op.between]: [startDate, endDate] },
            location_name: location
        };

        // Check total rows matching base filters
        const totalRows = await RbKw.count({ where: baseWhere });
        console.log('Total Rows (Location + Date):', totalRows);

        const platforms = await RbKw.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('platform_name')), 'platform_name']],
            where: baseWhere,
            raw: true
        });
        console.log('Available Platforms:', platforms);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
};

checkSos();
