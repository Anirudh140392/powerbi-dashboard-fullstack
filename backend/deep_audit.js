import { queryAdminDB } from './src/config/adminClickhouse.js';

async function deepAudit() {
    try {
        console.log("--- AUDIT: All Users & Roles ---");
        const users = await queryAdminDB("SELECT DISTINCT user_email, user_role FROM tb_user");
        console.table(users);

        console.log("\n--- AUDIT: Latest Access Records ---");
        const access = await queryAdminDB("SELECT user_email, ip, access, last_login FROM tb_user ORDER BY last_login DESC LIMIT 20");
        console.table(access);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
deepAudit();
