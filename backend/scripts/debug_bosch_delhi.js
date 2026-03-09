import 'dotenv/config';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import RbKw from './src/models/RbKw.js';
import sequelize from './src/config/db.js';
import { Op } from 'sequelize';

const debugBosch = async () => {
    try {
        console.log("Debugging Bosch Data...");

        const filters = {
            brand: 'Bosch',
            location: 'Delhi',
            platform: 'Zepto',
            startDate: new Date('2025-10-01'),
            endDate: new Date('2025-10-06')
        };

        console.log("Filters:", filters);

        // 1. Check Offtake & Availability in RbPdpOlap
        console.log("\n--- Checking RbPdpOlap (Offtake & Availability) ---");
        const olapWhere = {
            DATE: { [Op.between]: [filters.startDate, filters.endDate] },
            Brand: { [Op.like]: `%${filters.brand}%` },
            Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), filters.location.toLowerCase()),
            Platform: filters.platform
        };

        const olapCount = await RbPdpOlap.count({ where: olapWhere });
        console.log(`Total Rows in RbPdpOlap: ${olapCount}`);

        if (olapCount > 0) {
            const olapData = await RbPdpOlap.findAll({
                attributes: ['Brand', 'Platform', 'Location', 'Sales', 'neno_osa', 'deno_osa', 'DATE'],
                where: olapWhere,
                limit: 5,
                raw: true
            });
            console.log("Sample Rows:", olapData);
        } else {
            // Check if Bosch exists at all in Delhi/Zepto
            const anyBosch = await RbPdpOlap.findOne({
                where: {
                    Brand: { [Op.like]: `%${filters.brand}%` },
                    Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), filters.location.toLowerCase()),
                    Platform: filters.platform
                },
                attributes: ['DATE'],
                order: [['DATE', 'DESC']],
                raw: true
            });
            console.log("Latest Date for Bosch/Delhi/Zepto (any time):", anyBosch ? anyBosch.DATE : "Never found");
        }

        // 2. Check Share of Search in RbKw
        console.log("\n--- Checking RbKw (Share of Search) ---");
        const kwWhere = {
            kw_crawl_date: { [Op.between]: [filters.startDate, filters.endDate] },
            location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), filters.location.toLowerCase()),
            platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), filters.platform.toLowerCase())
        };

        const kwCount = await RbKw.count({ where: kwWhere });
        console.log(`Total Rows in RbKw (for location/platform): ${kwCount}`);

        if (kwCount > 0) {
            const boschKw = await RbKw.count({
                where: {
                    ...kwWhere,
                    brand_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), filters.brand.toLowerCase())
                }
            });
            console.log(`Rows matching Brand 'Bosch': ${boschKw}`);
        }

    } catch (error) {
        console.error("Debug Failed:", error);
    } finally {
        await sequelize.close();
    }
};

debugBosch();
