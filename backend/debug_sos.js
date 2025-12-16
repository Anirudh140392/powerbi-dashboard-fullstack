import dotenv from 'dotenv';
dotenv.config();

console.log("DB_HOST:", process.env.DB_HOST);

const runDebug = async () => {
    try {
        const { default: sequelize } = await import('./src/config/db.js');
        const { default: watchTowerService } = await import('./src/services/watchTowerService.js');

        console.log("Starting Debug...");
        await sequelize.authenticate();
        console.log("Database connected.");

        const filters = {
            months: 1,
            brand: 'Aer',
            platform: 'Zepto',
            location: 'All'
        };

        console.log("Calling getSummaryMetrics with:", filters);

        // Manual debug of the query
        const { Op } = await import('sequelize');
        const { default: RbKw } = await import('./src/models/RbKw.js');
        const dayjs = (await import('dayjs')).default;

        const startDate = dayjs().subtract(1, 'month').startOf('day');
        const endDate = dayjs().endOf('day');

        console.log(`Manual Debug Date Range: ${startDate.format()} to ${endDate.format()}`);

        const where = {
            kw_crawl_date: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            },
            platform_name: 'Zepto' // Try exact match first
        };

        const count = await RbKw.count({ where });
        console.log("Manual Count (Exact Platform):", count);

        const whereLower = {
            kw_crawl_date: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            },
            platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), 'zepto')
        };

        const countLower = await RbKw.count({ where: whereLower });
        console.log("Manual Count (Lower Platform):", countLower);

        const result = await watchTowerService.getSummaryMetrics(filters);

        console.log("Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Debug Error:", error);
    } finally {
        // We can't easily close sequelize here if we don't have the instance in scope, 
        // but the script will exit anyway.
        // To be clean:
        try {
            const { default: sequelize } = await import('./src/config/db.js');
            await sequelize.close();
        } catch (e) { }
    }
};

runDebug();
