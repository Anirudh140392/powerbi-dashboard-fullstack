import 'dotenv/config';
import sequelize from './src/config/db.js';

async function checkTable() {
    try {
        await sequelize.authenticate();

        // Check if table exists
        const [results] = await sequelize.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'tb_zepto_ads_data' AND TABLE_SCHEMA = '${process.env.DB_NAME}'
        `);

        if (results.length > 0) {
            console.log("Table tb_zepto_ads_data EXISTS.");
            // Get Columns
            const [columns] = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'tb_zepto_ads_data' AND TABLE_SCHEMA = '${process.env.DB_NAME}'
            `);
            console.log("COLUMNS:", JSON.stringify(columns.map(c => c.COLUMN_NAME), null, 2));
            // Check distinct values for a likely Zone column (e.g., 'zone', 'location')
            // Attempting to query 'zone' if it exists in the list above, but for now just logging columns to decide next step.
        } else {
            console.log("Table tb_zepto_ads_data DOES NOT EXIST.");
        }

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

checkTable();

