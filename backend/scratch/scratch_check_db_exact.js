import { queryAdminDB } from '../src/config/adminClickhouse.js';
async function test() {
    const res = await queryAdminDB(`SELECT toString(db_id) as db_id, Internal_kam FROM admin_master.tb_database WHERE db_id = 256044896700991019`);
    console.log(res[0].Internal_kam);
}
test().catch(console.error);
