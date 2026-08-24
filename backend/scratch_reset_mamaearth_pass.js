import bcrypt from 'bcrypt';
import adminClickhouse from './src/config/adminClickhouse.js';

async function run() {
    try {
        const email = 'kenil.k@trailytics.com';
        const plainPassword = 'Kenil@Kavar';
        const saltRounds = 10;
        const newHash = await bcrypt.hash(plainPassword, saltRounds);
        console.log(`Generated hash for '${plainPassword}': ${newHash}`);

        console.log(`Updating ${email} password_hash...`);
        // We use ALTER TABLE tb_user UPDATE because ClickHouse is MergeTree
        // Note: we must escape single quotes in strings.
        const query = `
            ALTER TABLE tb_user 
            UPDATE password_hash = '${newHash.replace(/'/g, "\\'")}' 
            WHERE user_email = '${email}'
        `;
        
        await adminClickhouse.command({ query });
        console.log("Update command sent. Waiting 3 seconds for mutation...");
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if updated
        const res = await adminClickhouse.query({
            query: `SELECT user_email, password_hash, access, status FROM tb_user WHERE user_email = '${email}' LIMIT 1`,
            format: 'JSONEachRow'
        });
        const data = await res.json();
        console.log("Updated rows in DB:", JSON.stringify(data, null, 2));

    } catch (e) {
        console.error("Failed to update password:", e);
    }
    process.exit(0);
}
run();
