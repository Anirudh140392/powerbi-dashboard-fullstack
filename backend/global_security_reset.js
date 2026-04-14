import { queryAdminDB } from './src/config/adminClickhouse.js';

async function globalReset() {
    try {
        console.log("CRITICAL: Resetting all non-admin users to 'pending' for security hardening...");
        
        // This mutation sets any user who is NOT an admin to 'pending'
        // It ensures no one is grandfathered in with an 'allow' status.
        const query = `
            ALTER TABLE tb_user 
            UPDATE access = 'pending' 
            WHERE lower(user_role) NOT LIKE '%admin%' 
            AND lower(user_role) NOT LIKE '%super%'
        `;
        
        await queryAdminDB(query);
        console.log("Global reset mutation started successfully.");
    } catch (e) {
        console.error("Global reset failed:", e);
    }
    process.exit();
}
globalReset();
