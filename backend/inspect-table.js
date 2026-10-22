import 'dotenv/config';
import sequelize from './src/config/db.js';

async function inspectTable() {
    try {
        await sequelize.authenticate();
        console.log("✅ DB Connected");

        const [results, metadata] = await sequelize.query("SELECT Platform, COUNT(*) as count FROM rb_pdp_olap GROUP BY Platform");
        console.log("Platform distribution:", results);

    } catch (error) {
        console.error("❌ Inspection Failed:", error);
    } finally {
        await sequelize.close();
    }
}

inspectTable();
