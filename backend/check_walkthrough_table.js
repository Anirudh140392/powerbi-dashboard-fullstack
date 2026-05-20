
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function checkTable() {
    try {
        const result = await queryAdminDB("DESCRIBE TABLE walkthrough_notifications");
        console.log("Table Schema:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error describing table:", err.message);
        console.log("Trying to list tables in admin_master...");
        try {
            const tables = await queryAdminDB("SHOW TABLES");
            console.log("Tables in admin_master:", tables);
        } catch (err2) {
            console.error("Error listing tables:", err2.message);
        }
    }
}

checkTable();
