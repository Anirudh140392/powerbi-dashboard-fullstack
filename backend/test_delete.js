import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    try {
        await queryAdminDB("ALTER TABLE tb_user DELETE WHERE toString(id) = 'none'");
        console.log("Success");
    } catch (e) { console.error(e); }
}
test();
