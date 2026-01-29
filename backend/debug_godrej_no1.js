
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import TbZeptoBrandSalesAnalytics from './src/models/TbZeptoBrandSalesAnalytics.js';
import RbKw from './src/models/RbKw.js';
import RbBrandMs from './src/models/RbBrandMs.js';

async function verifyGodrejNo1() {
    try {
        console.log("--- Verifying Godrej No.1 Data (Zepto) ---");

        const startDate = '2025-10-01';
        const endDate = '2025-12-09';
        const brand = 'Godrej No.1';
        const platform = 'Zepto';

        console.log(`Date Range: ${startDate} to ${endDate}`);

        // 1. Offtake (GMV) from TbZeptoBrandSalesAnalytics
        const salesData = await TbZeptoBrandSalesAnalytics.findOne({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('gmv')), 'total_sales']
            ],
            where: {
                brand_name: { [Op.like]: `%${brand}%` },
                sales_date: { [Op.between]: [startDate, endDate] }
            },
            raw: true
        });
        console.log("Offtake (GMV):", salesData);

        // 2. SOS from RbKw
        // Formula: (Brand Count - Sponsored Count) / Total Count
        const baseWhere = {
            kw_crawl_date: { [Op.between]: [startDate, endDate] },
            platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase())
        };

        const brandWhere = { ...baseWhere, brand_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brand.toLowerCase()) };
        const sponsoredWhere = { ...brandWhere, spons_flag: 1 };

        // Note: SOS denominator usually depends on category or location filters. 
        // If "All" categories is selected, it might be the total of ALL keywords for that platform?
        // Or is it restricted to the brand's categories?
        // In watchTowerService.js, if category is 'All', it uses baseWhere without category filter.

        const [brandCount, sponsoredCount, totalCount] = await Promise.all([
            RbKw.count({ where: brandWhere }),
            RbKw.count({ where: sponsoredWhere }),
            RbKw.count({ where: baseWhere })
        ]);

        console.log(`SOS Data: Brand Count=${brandCount}, Sponsored=${sponsoredCount}, Total=${totalCount}`);
        const sos = totalCount > 0 ? ((brandCount - sponsoredCount) / totalCount) * 100 : 0;
        console.log(`Calculated SOS: ${sos.toFixed(2)}%`);

        // 3. Market Share from RbBrandMs
        const msData = await RbBrandMs.findOne({
            attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
            where: {
                brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()),
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()),
                created_on: { [Op.between]: [startDate, endDate] }
            },
            raw: true
        });
        console.log("Market Share:", msData);

    } catch (error) {
        console.error("Error verifying Godrej No.1:", error);
    }
}

verifyGodrejNo1();
