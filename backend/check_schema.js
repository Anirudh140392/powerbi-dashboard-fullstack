import 'dotenv/config';
import sequelize from './src/config/db.js';

async function checkSchema() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'tb_zepto_ads_keyword_data' AND TABLE_SCHEMA = '${process.env.DB_NAME}'
        `);
        const columns = results.map(r => r.COLUMN_NAME);
        console.log("FULL_COLUMNS:", JSON.stringify(columns, null, 2));
    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

checkSchema();
