import { queryAdminDB } from '../backend/src/config/adminClickhouse.js';

async function main() {
    try {
        const users = await queryAdminDB("SELECT DISTINCT user_email, user_name, user_role, status, access FROM tb_user WHERE user_role = 'admin'");
        console.log(JSON.stringify(users, null, 2));
    } catch (err) {
        console.error(err);
    }
}

main();
