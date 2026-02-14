
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';

async function debugPromo() {
    try {
        console.log("--- Debugging Promo Metrics ---");

        const startDate = '2025-10-01';
        const endDate = '2025-12-09';
        const brand = 'Godrej No.1'; // Example brand

        // 1. Check Comp_flag for Godrej No.1
        console.log("\n1. Checking Comp_flag for Godrej No.1...");
        const godrejFlags = await RbPdpOlap.findAll({
            attributes: ['Comp_flag', [Sequelize.fn('COUNT', Sequelize.col('Web_Pid')), 'count']],
            where: { Brand: { [Op.like]: '%Godrej No.1%' } },
            group: ['Comp_flag'],
            raw: true
        });
        console.log("Godrej No.1 Comp_flags:", godrejFlags);

        // 2. Check MRP and Selling_Price for My Brand vs Compete
        console.log(`\n2. Checking Promo Depth for Brand: ${brand}`);

        const myBrandPromo = await RbPdpOlap.findOne({
            attributes: [
                [Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']
            ],
            where: {
                DATE: { [Op.between]: [startDate, endDate] },
                Brand: { [Op.like]: `%${brand}%` }
            },
            raw: true
        });
        console.log("My Brand Promo Depth:", myBrandPromo);

        const competePromo = await RbPdpOlap.findOne({
            attributes: [
                [Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']
            ],
            where: {
                DATE: { [Op.between]: [startDate, endDate] },
                Brand: { [Op.notLike]: `%${brand}%` }
            },
            raw: true
        });
        console.log("Compete Promo Depth:", competePromo);

        // 3. Check Inorg Sales (Ad Sales)
        console.log("\n3. Checking Inorg Sales (Ad_sales)...");
        const adSales = await RbPdpOlap.findOne({
            attributes: [[Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales']],
            where: {
                DATE: { [Op.between]: [startDate, endDate] },
                Brand: { [Op.like]: `%${brand}%` }
            },
            raw: true
        });
        console.log("Total Ad Sales:", adSales);

    } catch (error) {
        console.error("Error debugging promo:", error);
    }
}

debugPromo();
