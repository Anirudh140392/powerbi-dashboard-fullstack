import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function checkDbDates() {
    try {
        console.log("Checking latest data in zydus.rb_pdp_olap...");
        try {
            const zydusDate = await queryAdminDB("SELECT max(date) as max_date FROM zydus.rb_pdp_olap");
            console.log(`zydus latest date: ${zydusDate[0]?.max_date}`);
        } catch (e) {
            console.error("Failed to query zydus.rb_pdp_olap:", e.message);
        }

        console.log("\nChecking latest data in hm_zydus.rb_pdp_olap...");
        try {
            const hmZydusDate = await queryAdminDB("SELECT max(date) as max_date FROM hm_zydus.rb_pdp_olap");
            console.log(`hm_zydus latest date: ${hmZydusDate[0]?.max_date}`);
        } catch (e) {
            console.error("Failed to query hm_zydus.rb_pdp_olap:", e.message);
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
checkDbDates();
