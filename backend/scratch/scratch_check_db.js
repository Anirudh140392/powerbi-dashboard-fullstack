import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function test() {
    const res = await queryAdminDB(`SELECT toString(db_id) as db_id, Internal_kam FROM admin_master.tb_database WHERE Internal_kam != ''`);
    console.log(JSON.stringify(res, null, 2));
}
test().catch(console.error);
