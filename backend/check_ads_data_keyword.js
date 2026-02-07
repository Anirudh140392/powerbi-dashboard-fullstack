import 'dotenv/config';
import sequelize from './src/config/db.js';

async function checkTableKeywords() {
    try {
        await sequelize.authenticate();

        const tableName = 'tb_zepto_ads_data_keyword';

        // Check if table exists
        const [results] = await sequelize.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = '${process.env.DB_NAME}'
        `);

        if (results.length > 0) {
            console.log(`Table ${tableName} EXISTS.`);
            // Get Columns
            const [columns] = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = '${process.env.DB_NAME}'
            `);
            console.log("COLUMNS:", JSON.stringify(columns.map(c => c.COLUMN_NAME), null, 2));

            // Check for potential zone columns
            const zoneCol = columns.find(c => c.COLUMN_NAME.toLowerCase().includes('zone') || c.COLUMN_NAME.toLowerCase().includes('location'));
            if (zoneCol) console.log("FOUND POTENTIAL ZONE COLUMN:", zoneCol.COLUMN_NAME);

        } else {
            console.log(`Table ${tableName} DOES NOT EXIST.`);
        }

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

checkTableKeywords();
