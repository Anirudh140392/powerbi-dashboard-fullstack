import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function testVerify() {
    try {
        const dbName = 'zydus';
        console.log(`Querying logo for dbName: ${dbName}...`);
        const dbRows = await queryAdminDB(`
            SELECT logo_url FROM tb_database 
            WHERE lower(db_name) = '${dbName.toLowerCase()}' 
            LIMIT 1
        `);
        console.log("Query returned rows count:", dbRows.length);
        if (dbRows.length > 0) {
            const logo = dbRows[0].logo_url;
            console.log(`Logo URL length: ${logo.length}`);
            console.log(`Logo URL snippet: ${logo.substring(0, 100)}`);
        } else {
            console.log("No database rows found!");
        }
    } catch (err) {
        console.error("Query failed:", err.message);
    }
    process.exit(0);
}
testVerify();
