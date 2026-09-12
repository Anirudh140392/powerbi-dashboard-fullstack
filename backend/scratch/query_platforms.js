import 'dotenv/config';
import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function main() {
    try {
        console.log("=== Clickhouse mars.rb_platform ===");
        const marsExists = await queryAdminDB("EXISTS TABLE mars.rb_platform");
        if (marsExists[0].result === 1) {
            const marsPlats = await queryAdminDB("SELECT DISTINCT pf_name FROM mars.rb_platform WHERE status = 1");
            console.log("Mars Platforms:", marsPlats.map(r => r.pf_name));
        } else {
            console.log("mars.rb_platform table does not exist");
        }

        console.log("\n=== Clickhouse mamaearth.rb_platform ===");
        const mamaExists = await queryAdminDB("EXISTS TABLE mamaearth.rb_platform");
        if (mamaExists[0].result === 1) {
            const mamaPlats = await queryAdminDB("SELECT DISTINCT pf_name FROM mamaearth.rb_platform WHERE status = 1");
            console.log("Mamaearth Platforms:", mamaPlats.map(r => r.pf_name));
        } else {
            console.log("mamaearth.rb_platform table does not exist");
        }

    } catch (err) {
        console.error("Error in query_platforms:", err);
    }
}

main();
