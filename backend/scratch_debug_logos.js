import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';
import fs from 'fs';

async function check() {
    try {
        console.error("Fetching databases...");
        const result = await queryAdminDB("SELECT db_name, toString(db_id) as db_id, status, length(logo_url) as logo_len, substring(logo_url, 1, 100) as logo_start FROM tb_database");
        fs.writeFileSync('logos_debug.json', JSON.stringify(result, null, 2));
        console.error("Done writing logos_debug.json");
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
