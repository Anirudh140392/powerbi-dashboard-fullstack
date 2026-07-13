import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function check() {
    try {
        const databases = await queryAdminDB("SELECT DISTINCT db_name, toString(db_id) as db_id FROM tb_database");
        const dbMap = new Map();
        databases.forEach(db => dbMap.set(db.db_id, db.db_name));

        const users = await queryAdminDB(`
            SELECT * FROM (
                SELECT 
                    toString(user_id) as id,
                    user_email as email,
                    user_name as name,
                    user_role as role,
                    toString(db_id) as db_id,
                    if(empty(db_status), 'active', db_status) as db_status,
                    tab_permissions,
                    ip,
                    last_login
                FROM tb_user
                WHERE status != 'deleted'
                ORDER BY last_login DESC
                LIMIT 1 BY user_email
            )
            ORDER BY name ASC
        `);
        
        console.log("Mapped unique users:");
        users.forEach(user => {
            let finalDbName = 'N/A';
            if (dbMap.has(user.db_id)) {
                finalDbName = dbMap.get(user.db_id);
            } else {
                try {
                    const userDbIdNum = BigInt(user.db_id);
                    let closestDb = null;
                    let closestDiff = BigInt('999999999999999999');
                    for (const [dbId, name] of dbMap.entries()) {
                        const diff = userDbIdNum > BigInt(dbId) ? userDbIdNum - BigInt(dbId) : BigInt(dbId) - userDbIdNum;
                        if (diff < closestDiff) { closestDiff = diff; closestDb = name; }
                    }
                    if (closestDb && closestDiff < BigInt('1000')) finalDbName = closestDb;
                } catch (e) {}
            }
            console.log(`Email: ${user.email}, Name: ${user.name}, dbName: ${finalDbName}`);
        });
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
