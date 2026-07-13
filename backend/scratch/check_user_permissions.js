import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function check() {
    try {
        const users = await queryAdminDB(`
            SELECT 
                user_email,
                user_name,
                user_role,
                toString(db_id) as db_id,
                tab_permissions,
                last_login
            FROM tb_user
            ORDER BY last_login DESC
            LIMIT 1 BY user_email
        `);
        console.log("Users and their tab permissions:");
        users.forEach(u => {
            console.log(`Email: ${u.user_email} | Name: ${u.user_name} | Role: ${u.user_role}`);
            console.log(`Permissions: ${u.tab_permissions ? u.tab_permissions.substring(0, 150) + "..." : "(empty)"}`);
            console.log(`------------------------------------------`);
        });
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
