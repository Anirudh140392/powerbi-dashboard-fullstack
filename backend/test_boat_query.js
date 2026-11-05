import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function check() {
    try {
        const query = `
        SELECT 
            formatDateTime(toDate(DATE), '%Y-%m-%d') as date_group,
            MAX(toDate(DATE)) as ref_date,
            SUM(toFloat64OrZero(toString(Sales))) as total_sales
        FROM boat.rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '2026-05-18' AND '2026-05-18'
            AND toString(Comp_flag) = '0'
            AND lower(trim(BOTH '\t\n ' FROM Category)) IN ('headphones', 'neckbands')
            AND (lower(Brand) LIKE '%boat%')
            AND lower(Location) IN ('ahmedabad')
            AND lower(Platform) IN ('amazon', 'blinkit')
        GROUP BY date_group
        ORDER BY ref_date ASC
        `;
        const res = await queryAdminDB(query);
        console.log("Result:", res);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
