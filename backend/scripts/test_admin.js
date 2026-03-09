import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function checkDatabases() {
    try {
        const res = await queryAdminDB("SELECT db_id, db_name, status FROM tb_database");
        console.log(JSON.stringify(res, null, 2));
    } catch (err) {
        console.error(err);
    }
}
checkDatabases();
