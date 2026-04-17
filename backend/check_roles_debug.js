import { queryAdminDB } from './src/config/adminClickhouse.js';

async function checkRoles() {
    try {
        const result = await queryAdminDB("SELECT DISTINCT user_email, user_role FROM tb_user WHERE user_email IN ('sanyamadmin@trailytics.com', 'mamaearth@trailytics.com', 'boat@trailytics.com')");
        console.table(result);
        
        const allRoles = await queryAdminDB("SELECT DISTINCT user_role FROM tb_user");
        console.log("All existing roles:", allRoles);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
checkRoles();
