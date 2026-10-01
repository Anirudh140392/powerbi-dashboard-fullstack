import bcrypt from 'bcrypt';

const hash = '$2b$10$Vdf80VAh/tCvh/h11JtM0ObyQdVzc6wE.XOphEduAaAwk8MIxbU5C';
const passwords = [
    'mamaearth',
    'mamaearth123',
    'mamaearth@123',
    'Trailytics@123',
    'trailytics',
    'trailytics123',
    'admin',
    'admin123',
    'Admin@123',
    '12345678',
    '123456',
    'password',
    'Kenil@Kavar0604'
];

async function check() {
    for (const p of passwords) {
        const match = await bcrypt.compare(p, hash);
        if (match) {
            console.log(`MATCH FOUND: ${p}`);
            process.exit(0);
        }
    }
    console.log('No match found');
    process.exit(0);
}
check();
