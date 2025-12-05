
import dotenv from 'dotenv';
dotenv.config();
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import ZeptoMarketShare from './src/models/ZeptoMarketShare.js';
import { Op } from 'sequelize';

const debugGodrejProfessional = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        const brand = "Godrej Professional";
        const location = "Ahmedabad";
        const locationTypo = "Ahemdabad";

        console.log(`\n--- Debugging Data for '${brand}' ---`);

        // 1. Check Total Records for Brand
        const totalOlap = await RbPdpOlap.count({ where: { Brand: brand } });
        console.log(`Total RbPdpOlap records for '${brand}': ${totalOlap}`);

        const totalMarketShare = await ZeptoMarketShare.count({ where: { brand: brand } });
        console.log(`Total ZeptoMarketShare records for '${brand}': ${totalMarketShare}`);

        // 2. Check Distinct Locations for Brand
        const olapLocations = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'Location']],
            where: { Brand: brand },
            raw: true
        });
        console.log(`Distinct Locations in RbPdpOlap for '${brand}':`, olapLocations.map(l => l.Location));

        // 3. Check Data for Ahmedabad (and typo)
        const ahmedabadOlap = await RbPdpOlap.count({ where: { Brand: brand, Location: location } });
        console.log(`RbPdpOlap records in '${location}': ${ahmedabadOlap}`);

        const ahemdabadOlap = await RbPdpOlap.count({ where: { Brand: brand, Location: locationTypo } });
        console.log(`RbPdpOlap records in '${locationTypo}': ${ahemdabadOlap}`);

        // 4. Check Dates for Ahmedabad
        if (ahmedabadOlap > 0 || ahemdabadOlap > 0) {
            const loc = ahmedabadOlap > 0 ? location : locationTypo;
            console.log(`\nChecking Dates for '${brand}' in '${loc}'...`);

            const dates = await RbPdpOlap.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('DATE')), 'DATE']],
                where: { Brand: brand, Location: loc },
                order: [['DATE', 'ASC']],
                raw: true
            });
            console.log("Available Dates:", dates.map(d => d.DATE));

            // Check Platform
            const platforms = await RbPdpOlap.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Platform')), 'Platform']],
                where: { Brand: brand, Location: loc },
                raw: true
            });
            // Calculate Sums for Oct 1-6
            const startDate = '2025-10-01';
            const endDate = '2025-10-06';
            console.log(`\nCalculating Sums for ${startDate} to ${endDate}...`);

            const sums = await RbPdpOlap.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('Sales')), 'total_sales'],
                    [sequelize.fn('SUM', sequelize.col('neno_osa')), 'total_neno'],
                    [sequelize.fn('SUM', sequelize.col('deno_osa')), 'total_deno']
                ],
                where: {
                    Brand: brand,
                    Location: loc,
                    DATE: { [Op.between]: [startDate, endDate] }
                },
                raw: true
            });
            console.log("Sums:", sums);

            // Fetch Raw Rows for Oct 1-6
            console.log(`\nFetching Raw Rows for ${startDate} to ${endDate}...`);
            const rawRows = await RbPdpOlap.findAll({
                attributes: ['DATE', 'Sales', 'neno_osa', 'deno_osa'],
                where: {
                    Brand: brand,
                    Location: loc,
                    DATE: { [Op.between]: [startDate, endDate] }
                },
                raw: true
            });
            console.log("Raw Rows:", rawRows);

            // Check for ANY non-zero sales for this combination
            console.log(`\nChecking for ANY non-zero sales for '${brand}' in '${loc}'...`);
            const nonZeroSales = await RbPdpOlap.findOne({
                where: {
                    Brand: brand,
                    Location: loc,
                    Sales: { [Op.gt]: 0 }
                },
                raw: true
            });
            console.log("First Non-Zero Sales Record:", nonZeroSales);
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
};

debugGodrejProfessional();
