import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function check() {
    try {
        console.log("Databases in tb_database:");
        const dbs = await queryAdminDB("SELECT DISTINCT db_name, toString(db_id) as db_id_str FROM tb_database");
        console.log(dbs);

        console.log("\nUsers in tb_user (unique by email/name/db_id):");
        const users = await queryAdminDB("SELECT user_email, user_name, toString(db_id) as db_id_str, access, last_login FROM tb_user");
        console.log(users);
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
