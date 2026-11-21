import 'dotenv/config';
import { queryAdminDB } from '../src/config/adminClickhouse.js';
import { queryClickHouse } from '../src/config/clickhouse.js';

async function main() {
    try {
        console.log("=== Querying ClickHouse tables ===");
        // Let's query show databases or check tables in the current db
        const databases = await queryClickHouse("SHOW DATABASES");
        console.log("Databases in ClickHouse:");
        databases.forEach(db => console.log(`- ${db.name}`));

        // Check if rb_platform exists in the default database
        const defaultDb = process.env.CLICKHOUSE_DB || 'mars';
        console.log(`\nChecking if rb_platform exists in ${defaultDb}...`);
        try {
            const exists = await queryClickHouse(`EXISTS TABLE ${defaultDb}.rb_platform`);
            console.log(`EXISTS ${defaultDb}.rb_platform:`, exists);

            if (exists && exists[0] && exists[0].result === 1) {
                const platforms = await queryClickHouse(`SELECT DISTINCT pf_name, platform_description FROM ${defaultDb}.rb_platform WHERE status = 1`);
                console.log(`Platforms in ${defaultDb}.rb_platform:`);
                platforms.forEach(p => console.log(`- pf_name: ${p.pf_name}, desc: ${p.platform_description}`));
            }
        } catch (err) {
            console.error(`Error querying rb_platform in ${defaultDb}:`, err.message);
        }

        // Check the schema/data of tb_user in admin_master
        console.log("\ntb_user table description:");
        const descUser = await queryAdminDB("DESCRIBE TABLE tb_user");
        descUser.forEach(col => console.log(`- ${col.name}: ${col.type}`));

        console.log("\ntb_user row sample:");
        const users = await queryAdminDB("SELECT user_email, status, db_status, tab_permissions FROM tb_user LIMIT 5");
        users.forEach(u => console.log(JSON.stringify(u, null, 2)));

    } catch (err) {
        console.error("Error:", err);
    }
}

main();
