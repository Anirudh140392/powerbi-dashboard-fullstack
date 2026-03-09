
import { Sequelize, Op } from 'sequelize';
import dayjs from 'dayjs';

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
    Sales: { type: Sequelize.FLOAT },
    neno_osa: { type: Sequelize.FLOAT },
    deno_osa: { type: Sequelize.FLOAT }
}, { tableName: 'rb_pdp_olap', timestamps: false });

const RbKw = sequelize.define('rb_kw', {
    kw_crawl_date: { type: Sequelize.DATEONLY },
    brand_name: { type: Sequelize.STRING },
    platform_name: { type: Sequelize.STRING },
    location_name: { type: Sequelize.STRING },
    spons_flag: { type: Sequelize.INTEGER }
}, { tableName: 'rb_kw', timestamps: false });

const checkMetrics = async (label, start, end) => {
    console.log(`\n--- Checking: ${label} (${start} to ${end}) ---`);

    const baseWhere = {
        DATE: { [Op.between]: [start, end] },
        Brand: { [Op.like]: '%Aer%' },
        Platform: 'Zepto',
        Location: 'Agra'
    };

    // 1. Offtake
    const offtake = await RbPdpOlap.sum('Sales', { where: baseWhere });
    console.log(`Offtake: ₹${(offtake || 0).toLocaleString()}`);

    // 2. Availability
    const availData = await RbPdpOlap.findOne({
        attributes: [
            [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
            [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
        ],
        where: baseWhere,
        raw: true
    });
    const neno = availData?.total_neno || 0;
    const deno = availData?.total_deno || 0;
    console.log(`Availability: ${deno > 0 ? (neno / deno * 100).toFixed(1) : '0.0'}% (Neno: ${neno}, Deno: ${deno})`);

    // 3. Share of Search
    const sosWhere = {
        kw_crawl_date: { [Op.between]: [start, end] },
        location_name: 'Agra',
        platform_name: 'Zepto'
    };

    const denomCount = await RbKw.count({
        where: { ...sosWhere, spons_flag: { [Op.ne]: 1 } }
    });

    const numCount = await RbKw.count({
        where: { ...sosWhere, brand_name: { [Op.like]: '%Aer%' }, spons_flag: { [Op.ne]: 1 } }
    });

    console.log(`Share of Search: ${denomCount > 0 ? (numCount / denomCount * 100).toFixed(1) : '0.0'}% (Num: ${numCount}, Denom: ${denomCount})`);
};

const run = async () => {
    try {
        await sequelize.authenticate();

        // Case 1: Oct 1-6, 2025
        await checkMetrics('Specific Dates', '2025-10-01', '2025-10-06');

        // Case 2: Last 6 Months (Agra)
        const end = dayjs('2025-12-06').endOf('day').format('YYYY-MM-DD');
        const start = dayjs('2025-12-06').subtract(6, 'month').startOf('day').format('YYYY-MM-DD');
        await checkMetrics('Last 6 Months (Agra)', start, end);

        // Case 3: Last 6 Months (All Locations)
        console.log(`\n--- Checking: Last 6 Months (All Locations) (${start} to ${end}) ---`);
        const allLocWhere = {
            DATE: { [Op.between]: [start, end] },
            Brand: { [Op.like]: '%Aer%' },
            Platform: 'Zepto'
        };
        const offtakeAll = await RbPdpOlap.sum('Sales', { where: allLocWhere });
        console.log(`Offtake (Zepto + Aer + All Locs): ₹${(offtakeAll || 0).toLocaleString()}`);

        const availDataAll = await RbPdpOlap.findOne({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
            ],
            where: allLocWhere,
            raw: true
        });
        const nenoAll = availDataAll?.total_neno || 0;
        const denoAll = availDataAll?.total_deno || 0;
        console.log(`Availability (All Locs): ${denoAll > 0 ? (nenoAll / denoAll * 100).toFixed(1) : '0.0'}%`);

        const sosWhereAll = {
            kw_crawl_date: { [Op.between]: [start, end] },
            platform_name: 'Zepto'
        };
        const denomCountAll = await RbKw.count({ where: { ...sosWhereAll, spons_flag: { [Op.ne]: 1 } } });
        const numCountAll = await RbKw.count({ where: { ...sosWhereAll, brand_name: { [Op.like]: '%Aer%' }, spons_flag: { [Op.ne]: 1 } } });
        console.log(`Share of Search (All Locs): ${denomCountAll > 0 ? (numCountAll / denomCountAll * 100).toFixed(1) : '0.0'}%`);

    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
};

run();
