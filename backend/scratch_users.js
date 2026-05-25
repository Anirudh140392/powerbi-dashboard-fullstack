import { queryAdminDB } from './src/config/adminClickhouse.js';

async function run() {
    try {
        const users = await queryAdminDB("SELECT DISTINCT user_email, user_role, status, access FROM tb_user");
        console.log(users);
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}
run();
