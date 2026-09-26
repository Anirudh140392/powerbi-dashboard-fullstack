import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    try {
        const res = await queryAdminDB("SHOW CREATE TABLE tb_user");
        console.log(res[0].statement);
    } catch (e) { console.error(e); }
}
test();
