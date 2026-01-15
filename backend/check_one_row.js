import 'dotenv/config';
import sequelize from './src/config/db.js';

async function checkRow() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query("SELECT * FROM tb_zepto_ads_keyword_data LIMIT 1");
        if (results.length > 0) {
            console.log("ROW_KEYS:", Object.keys(results[0]));
        } else {
            console.log("No data found.");
        }
    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

checkRow();
