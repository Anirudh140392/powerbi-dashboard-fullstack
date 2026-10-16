import { queryAdminDB } from '../src/config/adminClickhouse.js';
async function run() {
    const dbs = await queryAdminDB(`SELECT toString(db_id) as db_id, Internal_kam FROM admin_master.tb_database WHERE Internal_kam != '' AND Internal_kam != '{}'`);
    let updated = 0;
    for (const db of dbs) {
        try {
            let kam = JSON.parse(db.Internal_kam);
            let changed = false;
            if (kam.all_platforms) {
                for (const [plat, users] of Object.entries(kam.all_platforms)) {
                    for (const user of users) {
                        for (const key of Object.keys(user)) {
                            if (key.startsWith('last_') && key.endsWith('_mail_sent')) {
                                user[key] = '2026-08-09';
                                changed = true;
                            }
                        }
                    }
                }
            }
            if (changed) {
                const str = JSON.stringify(kam).replace(/'/g, "\\'");
                const q = `ALTER TABLE admin_master.tb_database UPDATE Internal_kam = '${str}' WHERE db_id = ${db.db_id}`;
                await queryAdminDB(q);
                updated++;
                console.log(`Updated db_id: ${db.db_id}`);
            }
        } catch (e) {
            console.error("Error on db", db.db_id, e.message);
        }
    }
    console.log(`Finished resetting dates. Updated ${updated} databases.`);
}
run().catch(console.error);
