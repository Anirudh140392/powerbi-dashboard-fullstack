
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import TbBlinkitSalesData from './src/models/TbBlinkitSalesData.js';

async function checkBlinkitCategories() {
    try {
        console.log("Checking Blinkit Categories...");

        // Check distinct categories (if column exists)
        // TbBlinkitSalesData might not have a 'category' column directly, checking model definition or raw query
        // Based on previous code, it seems it might not have it or it was removed.
        // Let's check the table structure or just try to select distinct 'category' or similar.

        // Inspecting model definition via file read would be better, but let's try a raw query first to see columns
        const columns = await sequelize.query("SHOW COLUMNS FROM tb_blinkit_sales_data", { type: Sequelize.QueryTypes.SELECT });
        console.log("Columns in tb_blinkit_sales_data:", columns.map(c => c.Field));

        // If 'category' or 'sku_category' exists, fetch samples
        const catCol = columns.find(c => c.Field.toLowerCase().includes('cat'));
        if (catCol) {
            console.log(`Found category column: ${catCol.Field}`);

            const nonNullCount = await TbBlinkitSalesData.count({
                where: {
                    [catCol.Field]: { [Op.ne]: null }
                }
            });
            console.log(`Non-null category count: ${nonNullCount}`);

            if (nonNullCount > 0) {
                const cats = await TbBlinkitSalesData.findAll({
                    attributes: [[Sequelize.fn('DISTINCT', Sequelize.col(catCol.Field)), 'category']],
                    where: {
                        [catCol.Field]: { [Op.ne]: null }
                    },
                    limit: 20,
                    raw: true
                });
                console.log("Sample Non-Null Categories:", cats);
            }
        } else {
            console.log("No obvious category column found in tb_blinkit_sales_data.");
        }

    } catch (error) {
        console.error("Error checking Blinkit categories:", error);
    }
}

checkBlinkitCategories();
