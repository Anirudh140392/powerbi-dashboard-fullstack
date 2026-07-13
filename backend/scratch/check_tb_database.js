import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function check() {
    try {
        const dbs = await queryAdminDB("SELECT DISTINCT db_name, toString(db_id) as db_id_str FROM tb_database");
        console.log(dbs);
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
