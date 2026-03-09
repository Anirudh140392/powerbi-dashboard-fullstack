
import dotenv from 'dotenv';
dotenv.config();
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import { Op } from 'sequelize';

const debugAvailability = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        const brand = "Godrej No.1";
        const location = "Mumbai";
        const platform = "Zepto";

        console.log(`\nChecking Availability for: Brand='${brand}', Location='${location}', Platform='${platform}'`);

        // 1. Get Raw Records
        const records = await RbPdpOlap.findAll({
            attributes: ['DATE', 'neno_osa', 'deno_osa', 'Sales'],
            where: {
                Brand: brand,
                Location: location,
                Platform: platform
            },
            limit: 10,
            raw: true
        });

        console.log(`Found ${records.length} sample records:`);
        console.log(records);

        // 2. Perform SUM query manually to see what Sequelize returns
        const sumResult = await RbPdpOlap.findOne({
            attributes: [
                [sequelize.fn('SUM', sequelize.col('neno_osa')), 'total_neno'],
                [sequelize.fn('SUM', sequelize.col('deno_osa')), 'total_deno']
            ],
            where: {
                Brand: brand,
                Location: location,
                Platform: platform
            },
            raw: true
        });

        console.log("\nSUM Query Result:", sumResult);

        // 3. Check if casting helps (in case columns are strings)
        const castResult = await RbPdpOlap.findOne({
            attributes: [
                [sequelize.fn('SUM', sequelize.cast(sequelize.col('neno_osa'), 'UNSIGNED')), 'total_neno'],
                [sequelize.fn('SUM', sequelize.cast(sequelize.col('deno_osa'), 'UNSIGNED')), 'total_deno']
            ],
            where: {
                Brand: brand,
                Location: location,
                Platform: platform
            },
            raw: true
        });

        console.log("\nCAST SUM Query Result:", castResult);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
};

debugAvailability();
