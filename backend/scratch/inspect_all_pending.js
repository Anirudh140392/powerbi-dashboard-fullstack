import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function check() {
    try {
        const users = await queryAdminDB("SELECT id, user_email, user_name, toString(db_id) as db_id, access, last_login FROM tb_user WHERE access = 'pending'");
        console.log("All pending rows in tb_user:", users);
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
