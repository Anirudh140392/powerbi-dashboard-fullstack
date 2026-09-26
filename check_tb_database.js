import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { queryAdminDB } from './backend/src/config/adminClickhouse.js';

async function check() {
    try {
        console.log("Describing tb_database...");
        const result = await queryAdminDB("DESCRIBE TABLE tb_database");
        console.log("Columns in tb_database:");
        result.forEach(c => console.log(` - ${c.name} (${c.type})`));
    } catch (err) {
        console.error("Error describing tb_database:", err.message);
    }
    process.exit(0);
}
check();
