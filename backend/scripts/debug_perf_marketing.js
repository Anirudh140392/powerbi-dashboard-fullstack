
import { Sequelize, Op } from 'sequelize';
import dayjs from 'dayjs';

const sequelize = new Sequelize('gcpl', 'readonly_user', 'Readonly@123', {
    host: '15.207.197.27',
    dialect: 'mysql',
    logging: false
});

const RbKw = sequelize.define('rb_kw', {
    kw_crawl_date: { type: Sequelize.DATEONLY },
    brand_name: { type: Sequelize.STRING },
    platform_name: { type: Sequelize.STRING },
    location_name: { type: Sequelize.STRING },
    spons_flag: { type: Sequelize.INTEGER }
}, { tableName: 'rb_kw', timestamps: false });

const getSos = async (start, end, brand, location) => {
    const where = {
        kw_crawl_date: { [Op.between]: [start, end] },
        location_name: location,
        platform_name: 'Zepto'
    };

    const numWhere = { ...where, brand_name: brand, spons_flag: { [Op.ne]: 1 } };
    const denWhere = { ...where };

    const num = await RbKw.count({ where: numWhere });
    const den = await RbKw.count({ where: denWhere });

    return den > 0 ? (num / den) * 100 : 0;
};

const check = async () => {
    try {
        await sequelize.authenticate();

        const start = '2025-10-01';
        const end = '2025-10-06';
        const brand = 'Aer';
        const location = 'Agra';

        console.log(`Checking Performance Marketing for ${brand}/${location} (${start} to ${end})`);

        // Current
        const current = await getSos(start, end, brand, location);
        console.log(`Current SOS: ${current.toFixed(1)}%`);

        // MoM (Sep 1-6)
        const momStart = dayjs(start).subtract(1, 'month').format('YYYY-MM-DD');
        const momEnd = dayjs(end).subtract(1, 'month').format('YYYY-MM-DD');
        const mom = await getSos(momStart, momEnd, brand, location);
        const momChange = mom > 0 ? ((current - mom) / mom) * 100 : 0;
        console.log(`MoM SOS (${momStart} to ${momEnd}): ${mom.toFixed(1)}%`);
        console.log(`MoM Change: ${momChange.toFixed(1)}%`);

        // YoY (Oct 1-6 2024)
        const yoyStart = dayjs(start).subtract(1, 'year').format('YYYY-MM-DD');
        const yoyEnd = dayjs(end).subtract(1, 'year').format('YYYY-MM-DD');
        const yoy = await getSos(yoyStart, yoyEnd, brand, location);
        const yoyChange = yoy > 0 ? ((current - yoy) / yoy) * 100 : 0;
        console.log(`YoY SOS (${yoyStart} to ${yoyEnd}): ${yoy.toFixed(1)}%`);
        console.log(`YoY Change: ${yoyChange.toFixed(1)}%`);

    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
};

check();
