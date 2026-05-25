import { queryAdminDB } from './src/config/adminClickhouse.js';

async function run() {
    try {
        const users = await queryAdminDB("SELECT DISTINCT user_email, password_hash, user_role, status, access FROM tb_user WHERE user_email IN ('anirudh@trailytics.com', 'demo@trailytics.com')");
        console.log(JSON.stringify(users, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}
run();
