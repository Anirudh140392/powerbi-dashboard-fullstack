import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    const q = `
    SELECT 
        lower(Platform) as p, lower(Location) as l, lower(Brand) as b, lower(trim(BOTH '\t\n ' FROM Category)) as c,
        SUM(toFloat64OrZero(toString(Sales))) as total_sales,
        count(*) as count
    FROM boat.rb_pdp_olap
    WHERE toDate(DATE) = '2026-05-18'
    GROUP BY p, l, b, c
    ORDER BY total_sales DESC
    LIMIT 20
    `;
    const res = await queryAdminDB(q);
    console.log("Groups for May 18 in boat DB:", res);
    process.exit(0);
}
test();
