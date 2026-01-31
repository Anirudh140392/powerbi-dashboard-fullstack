import 'dotenv/config';
import sequelize from './src/config/db.js';

async function listColumns() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query("DESCRIBE tb_zepto_ads_keyword_data");
        const columns = results.map(r => r.Field);
        console.log("COLUMNS:", JSON.stringify(columns, null, 2));
    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

listColumns();
