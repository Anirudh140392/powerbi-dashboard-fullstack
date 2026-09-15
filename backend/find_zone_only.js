import 'dotenv/config';
import sequelize from './src/config/db.js';

async function findZoneOnly() {
    try {
        await sequelize.authenticate();

        console.log("Searching for columns named 'zone'...");

        const [results] = await sequelize.query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
            AND COLUMN_NAME LIKE '%zone%'
            ORDER BY TABLE_NAME
        `);

        if (results.length > 0) {
            console.log("FOUND TABLES WITH ZONE:", JSON.stringify(results, null, 2));
        } else {
            console.log("NO COLUMNS FOUND MATCHING '%zone%'.");
        }

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

findZoneOnly();
