import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    try {
        const dbName = 'hm_zydus';
        console.log(`Querying logo for dbName: ${dbName}`);
        const dbRows = await queryAdminDB(`
            SELECT logo_url FROM tb_database 
            WHERE lower(db_name) = '${dbName.toLowerCase()}' 
            LIMIT 1
        `);
        console.log("Returned rows count:", dbRows.length);
        if (dbRows.length > 0) {
            console.log("Logo URL length:", dbRows[0].logo_url ? dbRows[0].logo_url.length : 0);
            console.log("Logo URL value:", dbRows[0].logo_url);
        } else {
            console.log("No rows found!");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
test();
