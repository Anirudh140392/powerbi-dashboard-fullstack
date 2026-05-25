import { queryAdminDB } from './src/config/adminClickhouse.js';

async function run() {
    try {
        const users = await queryAdminDB("SELECT user_email, password_hash FROM tb_user WHERE status = 'active' LIMIT 10");
        console.log(users);
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}
run();
