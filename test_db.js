import { queryAdminDB } from './backend/src/config/adminClickhouse.js';

async function test() {
    const dbName = 'godrej';
    try {
        const q1 = `SELECT DISTINCT Category FROM ${dbName}.rb_pdp_olap WHERE lower(Platform) = 'blinkit'`;
        const res1 = await queryAdminDB(q1);
        console.log("PDP Categories godrej:", res1);
    } catch(e) { console.error(e.message); }

    try {
        const q2 = `SELECT DISTINCT keyword_category FROM ${dbName}.rb_kw_olap WHERE lower(platform_name) = 'blinkit'`;
        const res2 = await queryAdminDB(q2);
        console.log("SOS Categories (keyword_category) godrej:", res2);
    } catch(e) { console.error(e.message); }
}
test().catch(console.error);
