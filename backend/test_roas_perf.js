
import dotenv from 'dotenv';
dotenv.config();

const runCheck = async () => {
    try {
        const { default: sequelize } = await import('./src/config/db.js');
        const { default: RbPdpOlap } = await import('./src/models/RbPdpOlap.js');
        const { Sequelize, Op } = await import('sequelize');
        const dayjs = (await import('dayjs')).default;

        console.log("Testing ROAS query...");
        await sequelize.authenticate();

        const startDate = dayjs('2025-11-09');
        const endDate = dayjs('2025-12-09');

        console.time("Single ROAS Query");
        const result = await RbPdpOlap.sum('ROAS', {
            where: {
                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                Brand: { [Op.like]: '%Aer%' },
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), 'zepto')
            }
        });
        console.timeEnd("Single ROAS Query");
        console.log("Result:", result);

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
