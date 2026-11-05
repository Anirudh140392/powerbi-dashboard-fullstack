import { queryAdminDB } from '../src/config/adminClickhouse.js';
async function test() {
    const res = await queryAdminDB(`DESCRIBE TABLE admin_master.tb_database`);
    console.log(res.filter(r => r.name === 'db_id' || r.name === 'Internal_kam'));
}
test().catch(console.error);
