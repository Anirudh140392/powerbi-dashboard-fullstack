import 'dotenv/config';
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function check() {
    try {
        console.log("Fetching all from tb_database...");
        const result = await queryAdminDB("SELECT * FROM tb_database");
        console.log("Rows in tb_database:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error describing tb_database:", err.message);
    }
    process.exit(0);
}
check();
