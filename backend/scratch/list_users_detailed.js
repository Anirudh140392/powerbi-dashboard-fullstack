import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function run() {
    try {
        console.log("--- Listing all users ---");
        const users = await queryAdminDB("SELECT user_email, user_name, db_id, toString(db_id) as db_id_str, status, access FROM tb_user WHERE status = 'active' ORDER BY last_login DESC");
        console.log(users);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
