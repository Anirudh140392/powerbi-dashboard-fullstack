import { queryAdminDB } from '../backend/src/config/adminClickhouse.js';

async function main() {
    try {
        const users = await queryAdminDB("SELECT DISTINCT user_email, password_hash, user_role, status, access FROM tb_user WHERE status = 'active' AND access = 'allow'");
        console.log(JSON.stringify(users, null, 2));
    } catch (err) {
        console.error(err);
    }
}

main();
