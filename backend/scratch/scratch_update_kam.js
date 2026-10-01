import { queryAdminDB } from '../src/config/adminClickhouse.js';

const dbId = '10bc2818-6877-4475-b6d4-839fdf72b9a1'; // Example? Let me find out the db_id
async function test() {
    const dbs = await queryAdminDB(`SELECT toString(db_id) as db_id, Internal_kam FROM tb_database WHERE Internal_kam != ''`);
    console.log("DBs with KAM:", dbs.map(d => d.db_id));
    if (dbs.length === 0) return;
    
    for (const db of dbs) {
        let kam = JSON.parse(db.Internal_kam);
        // Make all dates 2026-08-09
        for (const [plat, users] of Object.entries(kam.all_platforms || {})) {
            for (const user of users) {
                for (const key of Object.keys(user)) {
                    if (key.startsWith('last_')) {
                        user[key] = '2026-08-09 16:30:00'; // Make sure the format matches
                    }
                }
            }
        }
        const str = JSON.stringify(kam);
        console.log("New KAM:", str);
        const q = `ALTER TABLE admin_master.tb_database UPDATE Internal_kam = '${str.replace(/'/g, "\\'")}' WHERE db_id = toUUID('${db.db_id}')`;
        console.log("Query:", q);
        try {
            await queryAdminDB(q);
            console.log("Updated db_id:", db.db_id);
        } catch(e) {
            console.error("Error updating", e);
        }
    }
}
test().catch(console.error);
