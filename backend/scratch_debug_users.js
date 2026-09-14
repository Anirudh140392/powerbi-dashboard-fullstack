import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';
import fs from 'fs';

async function check() {
    try {
        console.error("Fetching zydus specific logins...");
        const result = await queryAdminDB("SELECT user_email, user_name, toString(db_id) as db_id_str, access, last_login FROM tb_user WHERE user_email = 'zydus@trailytics.com' ORDER BY last_login DESC LIMIT 10");
        fs.writeFileSync('logins_zydus_only.json', JSON.stringify(result, null, 2));
        console.error("Done writing logins_zydus_only.json");
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
