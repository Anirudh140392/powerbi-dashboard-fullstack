import bcrypt from 'bcrypt';
import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function main() {
    const password = 'Pidilite@123#';
    const hash = await bcrypt.hash(password, 10);
    console.log('Generating hash for:', password);
    console.log('New hash:', hash);
    try {
        // Query to update the password_hash for pidilite@trailytics.com
        await queryAdminDB(`ALTER TABLE tb_user UPDATE password_hash = '${hash}' WHERE user_email = 'pidilite@trailytics.com'`);
        console.log('Update query sent. Checking user details...');
        // Wait 3 seconds for mutation to complete in ClickHouse
        await new Promise(resolve => setTimeout(resolve, 3000));
        const users = await queryAdminDB(`SELECT user_email, password_hash, access FROM tb_user WHERE user_email = 'pidilite@trailytics.com'`);
        console.log('Updated user records in DB:', users);
        
        // Let's also verify that bcrypt.compare works on this new hash
        if (users.length > 0) {
            const match = await bcrypt.compare(password, users[0].password_hash);
            console.log('Verification check - does bcrypt match?', match);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}
main();
