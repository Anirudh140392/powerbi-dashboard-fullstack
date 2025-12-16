
import dotenv from 'dotenv';
dotenv.config();

const runCheck = async () => {
    try {
        const { default: sequelize } = await import('./src/config/db.js');
        const { default: RbKw } = await import('./src/models/RbKw.js');
        const { Sequelize } = await import('sequelize');

        console.log("Checking RbKw data range...");
        await sequelize.authenticate();

        const result = await RbKw.findOne({
            attributes: [
                [Sequelize.fn('MIN', Sequelize.col('kw_crawl_date')), 'min_date'],
                [Sequelize.fn('MAX', Sequelize.col('kw_crawl_date')), 'max_date'],
                [Sequelize.fn('COUNT', Sequelize.col('kw_data_id')), 'total_count']
            ],
            raw: true
        });

        console.log("RbKw Data Range:", result);

        // Check a sample row
        const sample = await RbKw.findOne({ raw: true });
        console.log("Sample Row:", sample);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        try {
            const { default: sequelize } = await import('./src/config/db.js');
            await sequelize.close();
        } catch (e) { }
    }
};

runCheck();
