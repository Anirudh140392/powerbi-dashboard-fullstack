import bcrypt from 'bcrypt';
import { queryAdminDB, insertAdminDB } from '../backend/src/config/adminClickhouse.js';

async function main() {
    try {
        const email = 'admin@trailytics.com';
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        console.log('Password hash generated:', hash);

        // Check if user already exists
        const existing = await queryAdminDB(`SELECT * FROM tb_user WHERE user_email = '${email}'`);
        
        const row = {
            id: Date.now().toString(),
            user_id: '10001',
            user_email: email,
            user_name: 'Admin User',
            user_role: 'admin',
            password_hash: hash,
            db_id: '1', // default or colpal
            last_login: new Date().toISOString().replace('T', ' ').split('.')[0],
            created_on: new Date().toISOString().replace('T', ' ').split('.')[0],
            status: 'active',
            ip: '0.0.0.0',
            access: 'allow',
            db_status: 'active',
            tab_permissions: ''
        };

        await insertAdminDB('tb_user', [row]);
        console.log('Admin user created successfully.');
        
        // Also let's update test user 'dummy@test.com' to have bcrypt hash of 'admin123'
        // ClickHouse ALTER TABLE UPDATE can be used
        try {
            await queryAdminDB(`ALTER TABLE tb_user UPDATE password_hash = '${hash}' WHERE user_email = 'dummy@test.com'`);
            console.log('dummy@test.com password updated.');
        } catch (e) {
            console.error('Failed to update dummy user:', e.message);
        }

    } catch (err) {
        console.error('Error creating user:', err);
    }
}

main();
