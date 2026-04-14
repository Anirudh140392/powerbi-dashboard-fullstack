import { queryAdminDB } from './src/config/adminClickhouse.js';

async function debug() {
    try {
        // 1. Check ALL distinct emails and their roles
        console.log("=== ALL DISTINCT USER EMAILS & ROLES ===");
        const users = await queryAdminDB("SELECT DISTINCT user_email, user_role FROM tb_user ORDER BY user_email");
        console.table(users);

        // 2. Check access values per user (latest)
        console.log("\n=== LATEST ACCESS STATUS PER USER/IP ===");
        const access = await queryAdminDB(`
            SELECT user_email, ip, access, last_login, user_role
            FROM tb_user
            ORDER BY last_login DESC
            LIMIT 1 BY user_email, ip
        `);
        console.table(access);

        // 3. Check if ClickHouse mutation completed (the reset we ran)
        console.log("\n=== CHECK FOR ANY 'allow' NON-ADMIN ===");
        const allowed = await queryAdminDB(`
            SELECT user_email, ip, access, last_login, user_role
            FROM tb_user
            WHERE access = 'allow'
            AND lower(user_role) NOT LIKE '%admin%'
            AND lower(user_role) NOT LIKE '%super%'
        `);
        console.table(allowed);
        console.log(`Found ${allowed.length} allowed non-admin rows`);

        // 4. Check mutation status
        console.log("\n=== MUTATIONS STATUS ===");
        const mutations = await queryAdminDB(`
            SELECT command, is_done, create_time
            FROM system.mutations
            WHERE database = 'admin_master' AND table = 'tb_user'
            ORDER BY create_time DESC
            LIMIT 5
        `);
        console.table(mutations);

    } catch (e) {
        console.error(e);
    }
    process.exit();
}
debug();
