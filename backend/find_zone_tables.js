import 'dotenv/config';
import sequelize from './src/config/db.js';

async function findZoneColumn() {
    try {
        await sequelize.authenticate();

        console.log("Searching for columns named 'zone' or 'location' in schema:", process.env.DB_NAME);

        const [results] = await sequelize.query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
            AND (COLUMN_NAME LIKE '%zone%' OR COLUMN_NAME LIKE '%location%')
            ORDER BY TABLE_NAME
        `);

        
        if (results.length > 0) {
            console.log("FOUND TABLES:", JSON.stringify(results, null, 2));
        } else {
            console.log("NO TABLES FOUND with zone/location columns.");
        }

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

findZoneColumn();
