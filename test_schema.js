import { queryAdminDB } from './backend/src/config/adminClickhouse.js';

async function test() {
    try {
        const q1 = `DESCRIBE TABLE zydus.rb_pm_olap`;
        const res1 = await queryAdminDB(q1);
        console.log("zydus.rb_pm_olap schema:", res1.map(r => r.name).join(', '));
    } catch(e) { console.error(e.message); }
}
test().catch(console.error);
