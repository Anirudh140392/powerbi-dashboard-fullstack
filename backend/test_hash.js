import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    try {
        const res = await queryAdminDB("SELECT user_id, user_email, cityHash64(user_email) as hash1 FROM tb_user LIMIT 5");
        console.log(res);
    } catch (e) { console.error(e); }
}
test();
