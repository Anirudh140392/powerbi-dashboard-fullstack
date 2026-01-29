import sequelize from './src/config/db.js';
import RbKw from './src/models/RbKw.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import { Sequelize } from 'sequelize';
import dayjs from 'dayjs';

async function checkDateRanges() {
    try {
        console.log('Checking rb_kw table date ranges...');
        const kwDates = await RbKw.findAll({
            attributes: [
                [Sequelize.fn('MIN', Sequelize.col('kw_crawl_date')), 'min_date'],
                [Sequelize.fn('MAX', Sequelize.col('kw_crawl_date')), 'max_date'],
                [Sequelize.fn('COUNT', Sequelize.literal('*')), 'count']
            ],
            where: {
                platform_name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('platform_name')), 'zepto')
            },
            raw: true
        });
        console.log('rb_kw (Zepto):', kwDates[0]);

        console.log('\nChecking rb_pdp_olap table date ranges...');
        const olapDates = await RbPdpOlap.findAll({
            attributes: [
                [Sequelize.fn('MIN', Sequelize.col('DATE')), 'min_date'],
                [Sequelize.fn('MAX', Sequelize.col('DATE')), 'max_date'],
                [Sequelize.fn('COUNT', Sequelize.literal('*')), 'count']
            ],
            where: {
                Platform: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('Platform')), 'zepto')
            },
            raw: true
        });
        console.log('rb_pdp_olap (Zepto):', olapDates[0]);

        // Check sample data for 1M back
        const oneMonthAgo = dayjs().subtract(1, 'month').format('YYYY-MM-DD');
        const today = dayjs().format('YYYY-MM-DD');
        console.log(`\nChecking data availability for last 1 month (${oneMonthAgo} to ${today})...`);

        const kwCountMonth = await RbKw.count({
            where: {
                platform_name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('platform_name')), 'zepto'),
                kw_crawl_date: {
                    [Sequelize.Op.between]: [oneMonthAgo, today]
                }
            }
        });
        console.log('rb_kw rows in last month:', kwCountMonth);

        const olapCountMonth = await RbPdpOlap.count({
            where: {
                Platform: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('Platform')), 'zepto'),
                DATE: {
                    [Sequelize.Op.between]: [oneMonthAgo, today]
                }
            }
        });
        console.log('rb_pdp_olap rows in last month:', olapCountMonth);

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDateRanges();
