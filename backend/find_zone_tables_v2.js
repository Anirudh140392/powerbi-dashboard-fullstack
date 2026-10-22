import 'dotenv/config';
import sequelize from './src/config/db.js';

async function findZoneColumn() {
    try {
        await sequelize.authenticate();

        const [results] = await sequelize.query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
            AND (COLUMN_NAME LIKE '%zone%' OR COLUMN_NAME LIKE '%location%')
            ORDER BY TABLE_NAME
        `);

        const formatted = results.map(r => `${r.TABLE_NAME}.${r.COLUMN_NAME}`);
        console.log("MATCHES:", JSON.stringify(formatted, null, 2));

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

findZoneColumn();
