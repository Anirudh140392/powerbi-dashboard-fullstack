
import dotenv from 'dotenv';
dotenv.config();

const runCheck = async () => {
    try {
        const { default: sequelize } = await import('./src/config/db.js');
        const { default: RbPdpOlap } = await import('./src/models/RbPdpOlap.js');
        const { Sequelize } = await import('sequelize');

        console.log("Checking ROAS data...");
        await sequelize.authenticate();

        const results = await RbPdpOlap.findAll({
            attributes: ['ROAS', 'Ad_Spend', 'Ad_sales'],
            where: {
                ROAS: { [Sequelize.Op.ne]: null }
            },
            limit: 10,
            raw: true
        });

        console.log("Sample Data:", results);

        const stats = await RbPdpOlap.findOne({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('ROAS')), 'total_roas'],
                [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avg_roas'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                [Sequelize.fn('COUNT', Sequelize.col('Web_Pid')), 'count']
            ],
            raw: true
        });

        console.log("Stats:", stats);

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
