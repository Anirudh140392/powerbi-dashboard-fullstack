import { queryAdminDB } from './src/config/adminClickhouse.js';

async function verifyDatabases() {
    try {
        console.log("--- tb_database content ---");
        const dbs = await queryAdminDB("SELECT db_name, toString(db_id) as db_id FROM tb_database");
        console.log(JSON.stringify(dbs, null, 2));

        console.log("\n--- tb_user pending requests ---");
        const users = await queryAdminDB("SELECT user_email, toString(db_id) as db_id FROM tb_user WHERE access = 'pending' LIMIT 5");
        console.log(JSON.stringify(users, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
verifyDatabases();
