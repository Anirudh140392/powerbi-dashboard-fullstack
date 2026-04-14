import { queryAdminDB } from './src/config/adminClickhouse.js';

async function cleanupAdmins() {
    try {
        console.log("Cleaning up any accidental 'pending' status for admins...");
        const query = `
            ALTER TABLE tb_user 
            UPDATE access = 'allow' 
            WHERE access = 'pending' 
            AND (lower(user_role) LIKE '%admin%' OR lower(user_role) LIKE '%super%')
        `;
        await queryAdminDB(query);
        console.log("Cleanup mutation started.");
    } catch (e) {
        console.error("Cleanup failed:", e);
    }
    process.exit();
}
cleanupAdmins();
