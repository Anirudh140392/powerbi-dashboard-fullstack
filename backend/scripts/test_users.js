import { queryAdminDB } from './src/config/adminClickhouse.js';

async function checkUsers() {
    try {
        const res = await queryAdminDB("SELECT user_id, user_email, toString(db_id) as db_id FROM tb_user");
        console.log(JSON.stringify(res, null, 2));
    } catch (err) {
        console.error(err);
    }
}
checkUsers();
