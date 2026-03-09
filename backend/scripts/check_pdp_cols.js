
import dotenv from 'dotenv';
dotenv.config();

const runCheck = async () => {
    try {
        const { default: sequelize } = await import('./src/config/db.js');

        console.log("Checking rb_pdp_olap columns...");
        await sequelize.authenticate();

        const [results] = await sequelize.query("DESCRIBE rb_pdp_olap;");
        console.log("Columns:", results.map(r => r.Field));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        try {
            const { default: sequelize } = await import('./src/config/db.js');
            await sequelize.close();
        } catch (e) { }
    }
};

runCheck();
