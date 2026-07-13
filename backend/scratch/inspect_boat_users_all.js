import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function check() {
    try {
        const databases = await queryAdminDB("SELECT DISTINCT db_name, toString(db_id) as db_id FROM tb_database");
        const dbMap = new Map();
        databases.forEach(db => dbMap.set(db.db_id, db.db_name));

        const users = await queryAdminDB("SELECT DISTINCT user_email, user_name, toString(db_id) as db_id FROM tb_user");
        
        console.log("All unique (email, name, dbName) combinations mapping to 'boat':");
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
            if (finalDbName === 'boat') {
                console.log(`Email: ${user.user_email}, Name: ${user.user_name}`);
            }
        });
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
