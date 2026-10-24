import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function run() {
    try {
        console.log("Searching for users with name containing 'Manan'...");
        const users = await queryAdminDB(
            `SELECT DISTINCT user_name, user_email, user_role, toString(user_id) as user_id_str, toString(db_id) as db_id_str, status, access, db_status, tab_permissions 
             FROM tb_user 
             WHERE lower(user_name) LIKE '%manan%'`
        );
        console.log("USERS FOUND:", JSON.stringify(users, null, 2));

        console.log("Listing databases to find 'mars'...");
        const databases = await queryAdminDB("SELECT DISTINCT db_name, toString(db_id) as db_id_str FROM tb_database");
        console.log("DATABASES FOUND:", JSON.stringify(databases, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
