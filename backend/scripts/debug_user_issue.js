import 'dotenv/config';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import RbKw from './src/models/RbKw.js';
import sequelize from './src/config/db.js';
import { Op } from 'sequelize';

const debugUserIssue = async () => {
    try {
        console.log("Debugging User Issue...");

        const startDate = new Date('2025-10-01T00:00:00.000Z');
        const endDate = new Date('2025-11-30T23:59:59.000Z');
        const brand = 'Dettol';
        const location = 'Ahmedabad';
        const platform = 'Zepto';

        console.log(`Filters: Brand=${brand}, Location=${location}, Platform=${platform}, Date=${startDate.toISOString()} to ${endDate.toISOString()}`);

        // 1. Inspect Raw Rows in RbPdpOlap
        console.log("\n--- Inspecting Raw Rows in RbPdpOlap ---");
        const offtakeWhere = {
            DATE: { [Op.between]: [startDate, endDate] },
            Brand: { [Op.like]: `%${brand}%` },
            Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()),
            Platform: platform
        };
        const rawRows = await RbPdpOlap.findAll({
            attributes: ['Brand', 'Platform', 'Location', 'Sales', 'DATE'],
            where: offtakeWhere,
            limit: 5,
            raw: true
        });
        console.log("Sample Rows:", rawRows);

        // 2. Check Distinct Brands in RbKw for these filters
        console.log("\n--- Distinct Brands in RbKw ---");
        const sosWhere = {
            kw_crawl_date: { [Op.between]: [startDate, endDate] },
            location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase()),
            platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase())
        };
        const distinctBrands = await RbKw.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand_name')), 'brand_name']],
            where: sosWhere,
            limit: 20,
            raw: true
        });
        console.log("Available Brands:", distinctBrands.map(b => b.brand_name));

        // 3. Check for ANY non-null Sales in RbPdpOlap for Zepto/Ahmedabad
        console.log("\n--- Checking for ANY non-null Sales (RbPdpOlap) ---");
        const anySalesWhere = {
            DATE: { [Op.between]: [startDate, endDate] },
            Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()),
            Platform: platform,
            Sales: { [Op.ne]: null }
        };

        const anySalesResult = await RbPdpOlap.findOne({
            attributes: ['Brand', 'Sales'],
            where: anySalesWhere,
            raw: true
        });
        console.log("Found any non-null sales?", anySalesResult || "No non-null sales found");

        // 1. Check Offtake (Sales) in RbPdpOlap
        console.log("\n--- Checking Offtake (RbPdpOlap) ---");

        const offtakeResult = await RbPdpOlap.findOne({
            attributes: [
                [sequelize.fn('SUM', sequelize.col('Sales')), 'total_sales'],
                [sequelize.fn('COUNT', sequelize.col('Web_Pid')), 'count_rows']
            ],
            where: offtakeWhere,
            raw: true
        });
        console.log("Offtake Result:", offtakeResult);

        // 2. Check Share of Search (RbKw)
        console.log("\n--- Checking Share of Search (RbKw) ---");

        const sosCount = await RbKw.count({ where: sosWhere });
        console.log("Total Rows in RbKw for filters:", sosCount);

        if (sosCount > 0) {
            const numeratorWhere = { ...sosWhere };
            numeratorWhere.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brand.toLowerCase());
            numeratorWhere.spons_flag = { [Op.ne]: 1 };

            const numCount = await RbKw.count({ where: numeratorWhere });
            console.log("Numerator (Brand match, non-sponsored):", numCount);
        }

    } catch (error) {
        console.error("Debug Failed:", error);
    } finally {
        await sequelize.close();
    }
};

debugUserIssue();
