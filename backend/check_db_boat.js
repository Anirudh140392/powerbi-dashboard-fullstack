import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function check() {
    try {
        const dbs = await queryAdminDB('SHOW DATABASES');
        console.log('Databases:', dbs.map(d => d.name));
        for (let db of dbs) {
            try {
                const res = await queryAdminDB(`SELECT count(*) as c FROM ${db.name}.rb_pdp_olap WHERE lower(Brand) LIKE '%boat%'`);
                if (res[0].c > 0) {
                    console.log(`Found boat data in ${db.name}! Count: ${res[0].c}`);
                    
                    const maxDate = await queryAdminDB(`SELECT max(DATE) as md FROM ${db.name}.rb_pdp_olap`);
                    console.log(`Max date for ${db.name}.rb_pdp_olap is:`, maxDate[0].md);
                }
            } catch(e) {}
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
