import { queryAdminDB } from './src/config/adminClickhouse.js';

async function run() {
    try {
        const databases = await queryAdminDB("SELECT * FROM tb_database");
        console.log("DATABASES:", databases);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
