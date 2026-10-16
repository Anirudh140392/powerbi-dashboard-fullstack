import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    const q = `
    SELECT 
        toString(Comp_flag) as comp,
        count(*) as count
    FROM boat.rb_pdp_olap
    WHERE toDate(DATE) = '2026-05-18' 
      AND lower(Brand) LIKE '%boat%'
      AND lower(Location) = 'ahmedabad'
    GROUP BY comp
    `;
    const res = await queryAdminDB(q);
    console.log("Comp flag for boat in Ahmedabad:", res);
    process.exit(0);
}
test();
