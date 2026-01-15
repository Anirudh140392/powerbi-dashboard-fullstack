import 'dotenv/config';
import sequelize from './src/config/db.js';

async function describeTable() {
    try {
        await sequelize.authenticate();
        const [results, metadata] = await sequelize.query("DESCRIBE tb_zepto_ads_keyword_data");
        console.log("TABLE_SCHEMA:", JSON.stringify(results, null, 2));
    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

describeTable();
