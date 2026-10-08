import { queryAdminDB, insertAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    try {
        const hashRes = await queryAdminDB(`SELECT cityHash64('Kenil Kavar') as hash`);
        console.log(hashRes[0].hash);
    } catch (e) { console.error(e); }
}
test();
