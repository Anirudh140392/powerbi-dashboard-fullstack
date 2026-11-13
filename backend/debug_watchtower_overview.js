
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import TbZeptoBrandSalesAnalytics from './src/models/TbZeptoBrandSalesAnalytics.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';

async function verifyWatchtowerOverview() {
    try {
        console.log("--- Verifying Watchtower Overview Fix ---");

        const startDate = '2025-10-01';
        const endDate = '2025-12-09';
        const brand = 'Godrej No.1';
        const platform = 'Zepto';

        console.log(`Platform: ${platform}, Brand: ${brand}, Date: ${startDate} to ${endDate}`);

        // 1. Simulate Top Cards Offtake Query (Updated Logic)
        console.log("\n1. Simulating Top Cards Offtake Query...");
        const zeptoOfftake = await TbZeptoBrandSalesAnalytics.findAll({
            attributes: [
                [Sequelize.fn('DATE_FORMAT', Sequelize.col('sales_date'), '%Y-%m-01'), 'month_date'],
                [Sequelize.fn('SUM', Sequelize.col('gmv')), 'total_sales']
            ],
            where: {
                sales_date: { [Op.between]: [startDate, endDate] },
                brand_name: { [Op.like]: `%${brand}%` }
            },
            group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('sales_date'), '%Y-%m-01')],
            raw: true
        });

        const totalZeptoOfftake = zeptoOfftake.reduce((sum, d) => sum + parseFloat(d.total_sales), 0);
        console.log("Zepto Offtake (Top Cards):", totalZeptoOfftake);

        // 2. Compare with Old Logic (RbPdpOlap)
        console.log("\n2. Comparing with Old Logic (RbPdpOlap)...");
        const olapOfftake = await RbPdpOlap.findAll({
            attributes: [
                [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']
            ],
            where: {
                DATE: { [Op.between]: [startDate, endDate] },
                Brand: { [Op.like]: `%${brand}%` },
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase())
            },
            group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
            raw: true
        });
        const totalOlapOfftake = olapOfftake.reduce((sum, d) => sum + parseFloat(d.total_sales), 0);
        console.log("RbPdpOlap Offtake (Old Logic):", totalOlapOfftake);

        console.log(`\nDiscrepancy: ${totalOlapOfftake} (Old) vs ${totalZeptoOfftake} (New)`);

        if (Math.abs(totalZeptoOfftake - 2589482) < 1000) {
            console.log("SUCCESS: New logic matches verified Brands Overview data (approx 2.59 M).");
        } else {
            console.log("FAILURE: New logic does not match expected 2.59 M.");
        }

    } catch (error) {
        console.error("Error verifying Watchtower Overview:", error);
    }
}

verifyWatchtowerOverview();
