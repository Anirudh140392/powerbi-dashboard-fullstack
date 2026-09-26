import { queryAdminDB } from './backend/src/config/adminClickhouse.js';

async function test() {
    try {
        const q1 = `SHOW DATABASES`;
        const res1 = await queryAdminDB(q1);
        const databases = res1.map(r => r.name);
        
        for (const db of databases) {
            try {
                const q2 = `EXISTS TABLE ${db}.rb_pm_olap`;
                const res2 = await queryAdminDB(q2);
                // clickhouse EXISTS returns 1 if true, 0 if false
                if (res2[0].result === 1) {
                    console.log(`Found rb_pm_olap in DB: ${db}`);
                    // check if Blinkit GMFC is here
                    const q3 = `SELECT count(*) as c FROM ${db}.rb_pm_olap WHERE lower(Platform)='blinkit' AND lower(Category)='gmfc'`;
                    try {
                        const res3 = await queryAdminDB(q3);
                        console.log(`  Blinkit GMFC count: ${res3[0].c}`);
                    } catch(e) { console.log(`  Error querying Blinkit GMFC: ${e.message}`); }
                }
            } catch(e) {}
        }
    } catch(e) { console.error(e.message); }
}
test().catch(console.error);
