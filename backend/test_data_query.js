import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    try {
        const query1 = `
            SELECT lower(Platform) as p, lower(trim(BOTH '\t\n ' FROM Category)) as c, lower(Brand) as b, count(*)
            FROM zydus.rb_pdp_olap
            GROUP BY p, c, b
            ORDER BY count(*) DESC
            LIMIT 20
        `;
        const res1 = await queryAdminDB(query1);
        console.log("Groups:", res1);
        
        const maxDate = await queryAdminDB(`SELECT max(DATE) FROM zydus.rb_pdp_olap`);
        console.log("Max Date:", maxDate);

        const sample = await queryAdminDB(`SELECT * FROM zydus.rb_pdp_olap LIMIT 1`);
        console.log("Sample row:", sample);

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
