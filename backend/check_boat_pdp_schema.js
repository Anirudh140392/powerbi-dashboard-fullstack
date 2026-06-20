import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function check() {
    try {
        const res = await queryAdminDB("DESCRIBE boat.rb_pdp_olap");
        console.log("Columns:", res.map(r => r.name));
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
