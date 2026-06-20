import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';
import fs from 'fs';

async function check() {
    try {
        let results = {};
        console.error("Checking zydus...");
        try {
            const zydusDate = await queryAdminDB("SELECT max(DATE) as max_date FROM zydus.rb_pdp_olap");
            results.zydus = zydusDate[0]?.max_date;
        } catch (e) {
            results.zydus_error = e.message;
        }

        console.error("Checking hm_zydus...");
        try {
            const hmZydusDate = await queryAdminDB("SELECT max(DATE) as max_date FROM hm_zydus.rb_pdp_olap");
            results.hm_zydus = hmZydusDate[0]?.max_date;
        } catch (e) {
            results.hm_zydus_error = e.message;
        }

        fs.writeFileSync('dates_debug.json', JSON.stringify(results, null, 2));
        console.error("Done writing dates_debug.json");
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
check();
